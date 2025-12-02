import { storage } from "../storage";
import type { AlertTriggerType, AlertEvent, InsertAlertEvent } from "@shared/schema";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class AlertService {
  private rateLimitCache: Map<string, RateLimitEntry> = new Map();

  async emitAlert(
    userId: string,
    type: AlertTriggerType,
    options: {
      severity?: "low" | "medium" | "high" | "critical";
      title: string;
      message: string;
      data?: Record<string, any>;
    }
  ): Promise<AlertEvent | null> {
    const prefs = await storage.getAlertPreference(userId);
    if (!prefs || !prefs.enabledTriggers.includes(type)) {
      return null;
    }

    if (!this.checkRateLimit(userId, prefs.rateLimitPerMinute)) {
      return null;
    }

    const alertData: InsertAlertEvent = {
      userId,
      type,
      severity: options.severity || "medium",
      title: options.title,
      message: options.message,
      data: options.data || {},
    };

    const event = await storage.createAlertEvent(alertData);

    if (prefs.email) {
      await this.sendEmail(prefs.email, event).catch(err =>
        console.error("[AlertService] Email send failed:", err)
      );
      await storage.updateAlertDeliveryStatus(userId, event.id, true, false);
    }

    if (prefs.webhookUrl) {
      await this.sendWebhook(prefs.webhookUrl, event).catch(err =>
        console.error("[AlertService] Webhook send failed:", err)
      );
      await storage.updateAlertDeliveryStatus(userId, event.id, false, true);
    }

    return event;
  }

  private checkRateLimit(userId: string, limitPerMinute: number): boolean {
    const now = Date.now();
    const entry = this.rateLimitCache.get(userId);

    if (!entry || entry.resetAt < now) {
      this.rateLimitCache.set(userId, {
        count: 1,
        resetAt: now + 60 * 1000,
      });
      return true;
    }

    if (entry.count < limitPerMinute) {
      entry.count++;
      return true;
    }

    return false;
  }

  private async sendEmail(
    email: string,
    event: AlertEvent
  ): Promise<void> {
    const emailContent = this.formatEmailBody(event);
    if (process.env.SMTP_HOST) {
      console.log(`[AlertService] Would send email to ${email}: ${event.title}`);
    } else {
      console.log(`[AlertService] Email delivery skipped (no SMTP configured): ${email}`);
    }
  }

  private async sendWebhook(
    webhookUrl: string,
    event: AlertEvent
  ): Promise<void> {
    const payload = this.formatWebhookPayload(event);

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "NeuroNet-Governor/1.0",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      }

      console.log(`[AlertService] Webhook sent successfully to ${webhookUrl}`);
    } catch (error) {
      console.error(`[AlertService] Webhook delivery failed for ${webhookUrl}:`, error);
      throw error;
    }
  }

  private formatEmailBody(event: AlertEvent): string {
    return `
NeuroNet Governor Alert
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Type: ${event.type}
Severity: ${event.severity.toUpperCase()}
Title: ${event.title}

Message:
${event.message}

Details:
${JSON.stringify(event.data, null, 2)}

Time: ${new Date(event.createdAt).toUTCString()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
NeuroNet Governor – Always Watching.
    `.trim();
  }

  private formatWebhookPayload(event: AlertEvent) {
    const severityColors: Record<string, number> = {
      low: 3447003,
      medium: 15105570,
      high: 15158332,
      critical: 15158332,
    };

    return {
      content: `[${event.severity.toUpperCase()}] ${event.title}`,
      embeds: [
        {
          color: severityColors[event.severity] || 15105570,
          title: event.title,
          description: event.message,
          fields: [
            {
              name: "Alert Type",
              value: event.type,
              inline: true,
            },
            {
              name: "Severity",
              value: event.severity,
              inline: true,
            },
            {
              name: "Timestamp",
              value: new Date(event.createdAt).toISOString(),
              inline: false,
            },
          ],
          footer: {
            text: "NeuroNet Governor – Always Watching",
          },
        },
      ],
    };
  }

  async getUnreadAlerts(userId: string): Promise<AlertEvent[]> {
    const events = await storage.getAlertEvents(userId, 100);
    return events.filter(e => !e.read);
  }

  async markAsRead(userId: string, alertIds: string[]): Promise<void> {
    for (const alertId of alertIds) {
      await storage.markAlertAsRead(userId, alertId);
    }
  }
}

export const alertService = new AlertService();
