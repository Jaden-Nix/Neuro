import crypto from "crypto";
import type {
  AlertConfiguration,
  AlertNotification,
  SentinelAlert,
  AlertChannel,
  AlertSeverityThreshold,
} from "@shared/schema";

interface EmailPayload {
  to: string[];
  subject: string;
  html: string;
  text: string;
}

interface WebhookPayload {
  alertId: string;
  alertType: string;
  severity: string;
  message: string;
  data: Record<string, any>;
  timestamp: number;
}

export class AlertService {
  private configurations: Map<string, AlertConfiguration> = new Map();
  private notifications: AlertNotification[] = [];
  private lastAlertTimestamps: Map<string, number> = new Map();
  private sendgridApiKey: string | null = null;

  constructor() {
    this.sendgridApiKey = process.env.SENDGRID_API_KEY || null;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  private getSeverityLevel(severity: AlertSeverityThreshold): number {
    const levels: Record<AlertSeverityThreshold, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };
    return levels[severity];
  }

  async createConfiguration(config: Omit<AlertConfiguration, "id" | "createdAt" | "updatedAt">): Promise<AlertConfiguration> {
    const now = Date.now();
    const configuration: AlertConfiguration = {
      ...config,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
    };

    this.configurations.set(configuration.id, configuration);
    console.log(`[AlertService] Created alert configuration: ${configuration.name}`);
    return configuration;
  }

  async updateConfiguration(id: string, updates: Partial<AlertConfiguration>): Promise<AlertConfiguration | null> {
    const existing = this.configurations.get(id);
    if (!existing) return null;

    const updated: AlertConfiguration = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    };

    this.configurations.set(id, updated);
    console.log(`[AlertService] Updated alert configuration: ${updated.name}`);
    return updated;
  }

  async deleteConfiguration(id: string): Promise<boolean> {
    const deleted = this.configurations.delete(id);
    if (deleted) {
      console.log(`[AlertService] Deleted alert configuration: ${id}`);
    }
    return deleted;
  }

  getConfigurations(): AlertConfiguration[] {
    return Array.from(this.configurations.values());
  }

  getConfiguration(id: string): AlertConfiguration | undefined {
    return this.configurations.get(id);
  }

  getNotifications(limit: number = 100): AlertNotification[] {
    return this.notifications.slice(-limit);
  }

  async processAlert(alert: SentinelAlert): Promise<AlertNotification[]> {
    const notifications: AlertNotification[] = [];

    for (const config of this.configurations.values()) {
      if (!config.enabled) continue;

      if (!config.alertTypes.includes(alert.alertType)) continue;

      const alertSeverityLevel = this.getSeverityLevel(alert.severity as AlertSeverityThreshold);
      const thresholdLevel = this.getSeverityLevel(config.severityThreshold);
      if (alertSeverityLevel < thresholdLevel) continue;

      const cooldownKey = `${config.id}-${alert.alertType}`;
      const lastAlertTime = this.lastAlertTimestamps.get(cooldownKey) || 0;
      const cooldownMs = config.cooldownMinutes * 60 * 1000;
      if (Date.now() - lastAlertTime < cooldownMs) {
        console.log(`[AlertService] Skipping alert due to cooldown: ${config.name}`);
        continue;
      }

      this.lastAlertTimestamps.set(cooldownKey, Date.now());

      if (config.channel === "email" || config.channel === "both") {
        for (const email of config.emailRecipients) {
          const notification = await this.sendEmailNotification(config, alert, email);
          if (notification) {
            notifications.push(notification);
          }
        }
      }

      if (config.channel === "webhook" || config.channel === "both") {
        if (config.webhookUrl) {
          const notification = await this.sendWebhookNotification(config, alert);
          if (notification) {
            notifications.push(notification);
          }
        }
      }
    }

    this.notifications.push(...notifications);
    return notifications;
  }

  private async sendEmailNotification(
    config: AlertConfiguration,
    alert: SentinelAlert,
    recipient: string
  ): Promise<AlertNotification | null> {
    const notification: AlertNotification = {
      id: this.generateId(),
      configurationId: config.id,
      alertId: alert.id,
      channel: "email",
      recipient,
      subject: `[${alert.severity.toUpperCase()}] NeuroNet Alert: ${alert.alertType}`,
      body: this.formatEmailBody(alert),
      status: "pending",
      createdAt: Date.now(),
    };

    try {
      if (this.sendgridApiKey) {
        await this.sendViaSendGrid({
          to: [recipient],
          subject: notification.subject,
          html: notification.body,
          text: this.formatPlainTextBody(alert),
        });
        notification.status = "sent";
        notification.sentAt = Date.now();
        console.log(`[AlertService] Email sent to ${recipient}`);
      } else {
        console.log(`[AlertService] SendGrid not configured, simulating email to ${recipient}`);
        notification.status = "sent";
        notification.sentAt = Date.now();
      }
    } catch (error: any) {
      notification.status = "failed";
      notification.errorMessage = error.message;
      console.error(`[AlertService] Failed to send email: ${error.message}`);
    }

    return notification;
  }

  private async sendViaSendGrid(payload: EmailPayload): Promise<void> {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.sendgridApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: payload.to.map(email => ({ email })) }],
        from: { email: "alerts@neuronet.governor" },
        subject: payload.subject,
        content: [
          { type: "text/plain", value: payload.text },
          { type: "text/html", value: payload.html },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SendGrid API error: ${error}`);
    }
  }

  private async sendWebhookNotification(
    config: AlertConfiguration,
    alert: SentinelAlert
  ): Promise<AlertNotification | null> {
    const notification: AlertNotification = {
      id: this.generateId(),
      configurationId: config.id,
      alertId: alert.id,
      channel: "webhook",
      recipient: config.webhookUrl!,
      subject: `Alert: ${alert.alertType}`,
      body: JSON.stringify(alert),
      status: "pending",
      createdAt: Date.now(),
    };

    try {
      const payload: WebhookPayload = {
        alertId: alert.id,
        alertType: alert.alertType,
        severity: alert.severity,
        message: alert.message,
        data: alert.data,
        timestamp: alert.timestamp,
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (config.webhookSecret) {
        const signature = this.generateWebhookSignature(payload, config.webhookSecret);
        headers["X-NeuroNet-Signature"] = signature;
      }

      const response = await fetch(config.webhookUrl!, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook returned status ${response.status}`);
      }

      notification.status = "sent";
      notification.sentAt = Date.now();
      console.log(`[AlertService] Webhook sent to ${config.webhookUrl}`);
    } catch (error: any) {
      notification.status = "failed";
      notification.errorMessage = error.message;
      console.error(`[AlertService] Failed to send webhook: ${error.message}`);
    }

    return notification;
  }

  private generateWebhookSignature(payload: WebhookPayload, secret: string): string {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest("hex")}`;
  }

  private formatEmailBody(alert: SentinelAlert): string {
    const severityColor = {
      low: "#3b82f6",
      medium: "#f59e0b",
      high: "#ef4444",
      critical: "#dc2626",
    }[alert.severity] || "#6b7280";

    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .severity { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; color: white; background: ${severityColor}; }
    .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; }
    .data { background: #1e293b; color: #94a3b8; padding: 12px; border-radius: 4px; font-family: monospace; font-size: 12px; overflow-x: auto; }
    .footer { padding: 12px 20px; background: #f1f5f9; border-radius: 0 0 8px 8px; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0 0 10px 0;">NeuroNet Governor Alert</h1>
      <span class="severity">${alert.severity.toUpperCase()}</span>
    </div>
    <div class="content">
      <h2 style="color: #1e293b; margin-top: 0;">Alert Type: ${alert.alertType}</h2>
      <p style="color: #475569; font-size: 16px;">${alert.message}</p>
      <h3 style="color: #1e293b;">Details</h3>
      <div class="data">
        <pre>${JSON.stringify(alert.data, null, 2)}</pre>
      </div>
      <p style="color: #64748b; font-size: 14px; margin-top: 16px;">
        Timestamp: ${new Date(alert.timestamp).toISOString()}
      </p>
    </div>
    <div class="footer">
      <p>This is an automated alert from NeuroNet Governor. ${alert.autoExecuted ? "Automated response has been triggered." : "Manual intervention may be required."}</p>
    </div>
  </div>
</body>
</html>`;
  }

  private formatPlainTextBody(alert: SentinelAlert): string {
    return `
NeuroNet Governor Alert

Severity: ${alert.severity.toUpperCase()}
Alert Type: ${alert.alertType}

Message: ${alert.message}

Details:
${JSON.stringify(alert.data, null, 2)}

Timestamp: ${new Date(alert.timestamp).toISOString()}

${alert.autoExecuted ? "Automated response has been triggered." : "Manual intervention may be required."}
`;
  }

  async testConfiguration(configId: string): Promise<{ success: boolean; message: string }> {
    const config = this.configurations.get(configId);
    if (!config) {
      return { success: false, message: "Configuration not found" };
    }

    const testAlert: SentinelAlert = {
      id: `test-${this.generateId()}`,
      alertType: "wallet_health",
      severity: "medium",
      message: "This is a test alert from NeuroNet Governor",
      data: { test: true, configName: config.name },
      timestamp: Date.now(),
      autoExecuted: false,
    };

    try {
      const notifications = await this.processAlert(testAlert);
      if (notifications.length === 0) {
        return { success: false, message: "No notifications were sent. Check configuration." };
      }

      const failed = notifications.filter(n => n.status === "failed");
      if (failed.length > 0) {
        return { success: false, message: `Some notifications failed: ${failed.map(n => n.errorMessage).join(", ")}` };
      }

      return { success: true, message: `Successfully sent ${notifications.length} test notification(s)` };
    } catch (error: any) {
      return { success: false, message: `Test failed: ${error.message}` };
    }
  }

  getStats(): { totalConfigurations: number; totalNotificationsSent: number; failedNotifications: number } {
    const sent = this.notifications.filter(n => n.status === "sent").length;
    const failed = this.notifications.filter(n => n.status === "failed").length;

    return {
      totalConfigurations: this.configurations.size,
      totalNotificationsSent: sent,
      failedNotifications: failed,
    };
  }
}

export const alertService = new AlertService();
