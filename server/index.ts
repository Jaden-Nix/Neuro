import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from './stripeClient';
import { WebhookHandlers } from './webhookHandlers';
import { securityHeaders } from './middleware/auth';

const app = express();

// Apply security headers only to API routes (not frontend)
app.use('/api', securityHeaders);
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Initialize Stripe schema and sync data on startup
async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('[Stripe] DATABASE_URL not found, skipping Stripe initialization');
    return;
  }

  try {
    console.log('[Stripe] Initializing schema...');
    await runMigrations({ databaseUrl });
    console.log('[Stripe] Schema ready');

    const stripeSync = await getStripeSync();

    console.log('[Stripe] Setting up managed webhook...');
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    const { webhook, uuid } = await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`,
      { enabled_events: ['*'], description: 'NeuroNet Marketplace webhook' }
    );
    console.log(`[Stripe] Webhook configured: ${webhook.url} (uuid: ${uuid})`);
    
    // Store UUID for webhook handler reference
    process.env.STRIPE_WEBHOOK_UUID = uuid;

    // Sync Stripe data in background
    stripeSync.syncBackfill()
      .then(() => console.log('[Stripe] Data synced'))
      .catch((err: any) => console.error('[Stripe] Sync error:', err));
  } catch (error) {
    console.error('[Stripe] Initialization failed:', error);
  }
}

// Initialize Stripe first
await initStripe();

// Stripe webhook handler function
const handleStripeWebhook = async (req: express.Request, res: express.Response) => {
  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).json({ error: 'Missing stripe-signature' });
  }

  try {
    const sig = Array.isArray(signature) ? signature[0] : signature;
    if (!Buffer.isBuffer(req.body)) {
      console.error('[Stripe] Webhook body is not a Buffer');
      return res.status(500).json({ error: 'Webhook processing error' });
    }

    // Use UUID from params or from environment (set during initStripe)
    const uuid = (req.params as any).uuid || process.env.STRIPE_WEBHOOK_UUID;
    if (!uuid) {
      console.error('[Stripe] No webhook UUID available');
      return res.status(500).json({ error: 'Webhook configuration error' });
    }
    
    await WebhookHandlers.processWebhook(req.body as Buffer, sig, uuid);
    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[Stripe] Webhook error:', error.message);
    res.status(400).json({ error: 'Webhook processing error' });
  }
};

// Register Stripe webhook routes BEFORE express.json() - webhook needs raw Buffer
// Both routes are registered to handle both direct and UUID-based webhook calls
app.post('/api/stripe/webhook/:uuid', express.raw({ type: 'application/json' }), handleStripeWebhook);
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Now apply JSON middleware for all other routes
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
