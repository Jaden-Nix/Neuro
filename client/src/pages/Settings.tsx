import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AlertTriggerType } from "@shared/schema";

const alertPreferenceSchema = z.object({
  email: z.string().email("Invalid email").or(z.literal("")),
  webhookUrl: z.string().url("Invalid URL").or(z.literal("")),
  rateLimitPerMinute: z.number().int().min(1).max(100),
  transaction_failed: z.boolean(),
  high_risk_strategy: z.boolean(),
  agent_conflict: z.boolean(),
  parliament_deadlock: z.boolean(),
  opportunity_found: z.boolean(),
  balance_drop: z.boolean(),
  system_error: z.boolean(),
  rpc_failure: z.boolean(),
});

type AlertPreferenceForm = z.infer<typeof alertPreferenceSchema>;

const ALERT_TRIGGERS: { id: AlertTriggerType; label: string; description: string }[] = [
  { id: "transaction_failed", label: "Transaction Failed", description: "When a transaction fails" },
  { id: "high_risk_strategy", label: "High-Risk Strategy Detected", description: "When risk score exceeds threshold" },
  { id: "agent_conflict", label: "Agent Conflict / Veto", description: "When agents disagree" },
  { id: "parliament_deadlock", label: "Parliament Deadlock", description: "When voting deadlocks" },
  { id: "opportunity_found", label: "New Opportunity Found", description: "When profitable opportunities detected" },
  { id: "balance_drop", label: "Balance Drop", description: "When wallet balance decreases significantly" },
  { id: "system_error", label: "System Error", description: "When system encounters errors" },
  { id: "rpc_failure", label: "RPC Failure", description: "When RPC calls fail" },
];

export default function Settings() {
  const { toast } = useToast();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["/api/alerts/preferences"],
    queryFn: async () => {
      const res = await apiRequest("/api/alerts/preferences", { method: "GET" });
      return res as any;
    },
  });

  const { data: unreadAlerts } = useQuery({
    queryKey: ["/api/alerts/unread"],
    queryFn: async () => {
      const res = await apiRequest("/api/alerts/unread", { method: "GET" });
      return res as any[];
    },
    refetchInterval: 5000,
  });

  const form = useForm<AlertPreferenceForm>({
    resolver: zodResolver(alertPreferenceSchema),
    defaultValues: {
      email: "",
      webhookUrl: "",
      rateLimitPerMinute: 3,
      transaction_failed: false,
      high_risk_strategy: false,
      agent_conflict: false,
      parliament_deadlock: false,
      opportunity_found: false,
      balance_drop: false,
      system_error: false,
      rpc_failure: false,
    },
  });

  useEffect(() => {
    if (preferences) {
      form.reset({
        email: preferences.email || "",
        webhookUrl: preferences.webhookUrl || "",
        rateLimitPerMinute: preferences.rateLimitPerMinute || 3,
        transaction_failed: preferences.enabledTriggers?.includes("transaction_failed") || false,
        high_risk_strategy: preferences.enabledTriggers?.includes("high_risk_strategy") || false,
        agent_conflict: preferences.enabledTriggers?.includes("agent_conflict") || false,
        parliament_deadlock: preferences.enabledTriggers?.includes("parliament_deadlock") || false,
        opportunity_found: preferences.enabledTriggers?.includes("opportunity_found") || false,
        balance_drop: preferences.enabledTriggers?.includes("balance_drop") || false,
        system_error: preferences.enabledTriggers?.includes("system_error") || false,
        rpc_failure: preferences.enabledTriggers?.includes("rpc_failure") || false,
      });
    }
  }, [preferences, form]);

  const saveMutation = useMutation({
    mutationFn: async (data: AlertPreferenceForm) => {
      const enabledTriggers = ALERT_TRIGGERS.filter(t => data[t.id as keyof AlertPreferenceForm]).map(t => t.id);
      
      return apiRequest("/api/alerts/preferences", {
        method: "POST",
        body: JSON.stringify({
          email: data.email || undefined,
          webhookUrl: data.webhookUrl || undefined,
          rateLimitPerMinute: data.rateLimitPerMinute,
          enabledTriggers,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Preferences saved",
        description: "Alert preferences have been updated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/preferences"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save preferences",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6 p-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Alert Preferences</h1>
        <p className="text-sm text-secondary mt-1">Configure how you want to receive alerts</p>
      </div>

      <Card className="p-6 space-y-6">
        <form onSubmit={form.handleSubmit(data => saveMutation.mutate(data))} className="space-y-6">
          {/* Delivery Channels */}
          <div className="space-y-4">
            <h2 className="font-semibold">Delivery Channels</h2>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                data-testid="input-email"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook" className="text-sm">Webhook URL (Discord/Slack/Telegram)</Label>
              <Input
                id="webhook"
                type="url"
                placeholder="https://discord.com/api/webhooks/..."
                data-testid="input-webhook-url"
                {...form.register("webhookUrl")}
              />
              {form.formState.errors.webhookUrl && (
                <p className="text-xs text-destructive">{form.formState.errors.webhookUrl.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="rateLimit" className="text-sm">Rate Limit (max alerts/minute)</Label>
              <Input
                id="rateLimit"
                type="number"
                min="1"
                max="100"
                data-testid="input-rate-limit"
                {...form.register("rateLimitPerMinute", { valueAsNumber: true })}
              />
            </div>
          </div>

          {/* Alert Triggers */}
          <div className="space-y-4">
            <h2 className="font-semibold">Alert Triggers</h2>
            <p className="text-xs text-secondary">Choose which events trigger alerts</p>

            <div className="grid gap-3">
              {ALERT_TRIGGERS.map(trigger => (
                <div key={trigger.id} className="flex items-start gap-3 p-3 border rounded-md hover-elevate">
                  <Checkbox
                    id={trigger.id}
                    data-testid={`checkbox-alert-${trigger.id}`}
                    {...form.register(trigger.id)}
                  />
                  <div className="flex-1">
                    <label htmlFor={trigger.id} className="text-sm font-medium cursor-pointer">
                      {trigger.label}
                    </label>
                    <p className="text-xs text-secondary">{trigger.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            disabled={saveMutation.isPending}
            data-testid="button-save-preferences"
            className="w-full"
          >
            {saveMutation.isPending ? "Saving..." : "Save Preferences"}
          </Button>
        </form>
      </Card>

      {/* Unread Alerts Preview */}
      {unreadAlerts && unreadAlerts.length > 0 && (
        <Card className="p-6 space-y-4">
          <h2 className="font-semibold">Recent Alerts ({unreadAlerts.length})</h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {unreadAlerts.slice(-5).reverse().map(alert => (
              <div key={alert.id} className="text-xs p-2 border rounded bg-card">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{alert.title}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    alert.severity === "critical" ? "bg-destructive/20 text-destructive" :
                    alert.severity === "high" ? "bg-orange-500/20 text-orange-600" :
                    alert.severity === "medium" ? "bg-yellow-500/20 text-yellow-600" :
                    "bg-blue-500/20 text-blue-600"
                  }`}>
                    {alert.severity}
                  </span>
                </div>
                <p className="text-secondary mt-1">{alert.message}</p>
                <p className="text-tertiary mt-1">{new Date(alert.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
