import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Bell, Mail, Webhook, Plus, Trash2, TestTube, CheckCircle, XCircle, Clock, Settings2 } from "lucide-react";
import type { AlertConfiguration, AlertNotification } from "@shared/schema";

export default function Alerts() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    channel: "email" as "email" | "webhook" | "both",
    emailRecipients: "",
    webhookUrl: "",
    webhookSecret: "",
    severityThreshold: "medium" as "low" | "medium" | "high" | "critical",
    alertTypes: ["wallet_health", "liquidity_change", "peg_deviation"],
    cooldownMinutes: 15,
  });

  const { data: configurations = [], isLoading: configsLoading } = useQuery<AlertConfiguration[]>({
    queryKey: ["/api/alerts/configurations"],
  });

  const { data: notifications = [], isLoading: notifsLoading } = useQuery<AlertNotification[]>({
    queryKey: ["/api/alerts/notifications"],
  });

  const { data: stats } = useQuery<{
    totalConfigurations: number;
    totalNotificationsSent: number;
    failedNotifications: number;
  }>({
    queryKey: ["/api/alerts/stats"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/alerts/configurations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/configurations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/stats"] });
      setShowForm(false);
      resetForm();
      toast({ title: "Configuration created", description: "Alert configuration has been created successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/alerts/configurations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/configurations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/stats"] });
      toast({ title: "Configuration deleted", description: "Alert configuration has been removed" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/alerts/configurations/${id}/test`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/notifications"] });
      toast({
        title: data.success ? "Test successful" : "Test failed",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiRequest("PATCH", `/api/alerts/configurations/${id}`, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts/configurations"] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      channel: "email",
      emailRecipients: "",
      webhookUrl: "",
      webhookSecret: "",
      severityThreshold: "medium",
      alertTypes: ["wallet_health", "liquidity_change", "peg_deviation"],
      cooldownMinutes: 15,
    });
  };

  const handleSubmit = () => {
    const data = {
      ...formData,
      emailRecipients: formData.emailRecipients.split(",").map(e => e.trim()).filter(e => e),
      enabled: true,
    };
    createMutation.mutate(data);
  };

  const alertTypeOptions = [
    "wallet_health",
    "liquidity_change",
    "peg_deviation",
    "volatility_spike",
    "oracle_anomaly",
    "pool_drain",
    "liquidation_risk",
  ];

  const severityColors = {
    low: "text-blue-500 bg-blue-500/10",
    medium: "text-yellow-500 bg-yellow-500/10",
    high: "text-orange-500 bg-orange-500/10",
    critical: "text-red-500 bg-red-500/10",
  };

  const statusColors = {
    sent: "bg-green-500/10 text-green-500",
    pending: "bg-yellow-500/10 text-yellow-500",
    failed: "bg-red-500/10 text-red-500",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Alert System</h1>
          <p className="text-muted-foreground">Configure email and webhook notifications for critical events</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} data-testid="button-new-alert">
          <Plus className="h-4 w-4 mr-2" />
          New Configuration
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Configurations</CardTitle>
            <Settings2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-configs">
              {stats?.totalConfigurations ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Notifications Sent</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-sent-count">
              {stats?.totalNotificationsSent ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Notifications</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-failed-count">
              {stats?.failedNotifications ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Alert Configuration</CardTitle>
            <CardDescription>Set up a new notification channel for system alerts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Configuration Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Critical Alerts"
                  data-testid="input-config-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="channel">Notification Channel</Label>
                <Select
                  value={formData.channel}
                  onValueChange={(v) => setFormData({ ...formData, channel: v as any })}
                >
                  <SelectTrigger data-testid="select-channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email Only</SelectItem>
                    <SelectItem value="webhook">Webhook Only</SelectItem>
                    <SelectItem value="both">Both Email & Webhook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(formData.channel === "email" || formData.channel === "both") && (
              <div className="space-y-2">
                <Label htmlFor="emails">Email Recipients (comma-separated)</Label>
                <Input
                  id="emails"
                  value={formData.emailRecipients}
                  onChange={(e) => setFormData({ ...formData, emailRecipients: e.target.value })}
                  placeholder="admin@example.com, alerts@example.com"
                  data-testid="input-emails"
                />
              </div>
            )}

            {(formData.channel === "webhook" || formData.channel === "both") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="webhookUrl">Webhook URL</Label>
                  <Input
                    id="webhookUrl"
                    value={formData.webhookUrl}
                    onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                    placeholder="https://your-webhook.com/endpoint"
                    data-testid="input-webhook-url"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="webhookSecret">Webhook Secret (optional)</Label>
                  <Input
                    id="webhookSecret"
                    type="password"
                    value={formData.webhookSecret}
                    onChange={(e) => setFormData({ ...formData, webhookSecret: e.target.value })}
                    placeholder="Signing secret for HMAC"
                    data-testid="input-webhook-secret"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="severity">Minimum Severity</Label>
                <Select
                  value={formData.severityThreshold}
                  onValueChange={(v) => setFormData({ ...formData, severityThreshold: v as any })}
                >
                  <SelectTrigger data-testid="select-severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cooldown">Cooldown (minutes)</Label>
                <Input
                  id="cooldown"
                  type="number"
                  value={formData.cooldownMinutes}
                  onChange={(e) => setFormData({ ...formData, cooldownMinutes: parseInt(e.target.value) || 15 })}
                  data-testid="input-cooldown"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Alert Types</Label>
              <div className="flex flex-wrap gap-2">
                {alertTypeOptions.map((type) => (
                  <Badge
                    key={type}
                    variant={formData.alertTypes.includes(type) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      const types = formData.alertTypes.includes(type)
                        ? formData.alertTypes.filter((t) => t !== type)
                        : [...formData.alertTypes, type];
                      setFormData({ ...formData, alertTypes: types });
                    }}
                    data-testid={`badge-alert-type-${type}`}
                  >
                    {type.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending} data-testid="button-create">
              Create Configuration
            </Button>
          </CardFooter>
        </Card>
      )}

      <Tabs defaultValue="configurations">
        <TabsList>
          <TabsTrigger value="configurations" data-testid="tab-configurations">Configurations</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">Notification History</TabsTrigger>
        </TabsList>

        <TabsContent value="configurations" className="space-y-4">
          {configsLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">Loading configurations...</CardContent>
            </Card>
          ) : configurations.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No alert configurations. Create one to start receiving notifications.
              </CardContent>
            </Card>
          ) : (
            configurations.map((config) => (
              <Card key={config.id} data-testid={`card-config-${config.id}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {config.channel === "email" && <Mail className="h-4 w-4" />}
                      {config.channel === "webhook" && <Webhook className="h-4 w-4" />}
                      {config.channel === "both" && <Bell className="h-4 w-4" />}
                      {config.name}
                    </CardTitle>
                    <CardDescription>
                      Channel: {config.channel} | Cooldown: {config.cooldownMinutes}min
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.enabled}
                      onCheckedChange={(enabled) => toggleMutation.mutate({ id: config.id, enabled })}
                      data-testid={`switch-enabled-${config.id}`}
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => testMutation.mutate(config.id)}
                      disabled={testMutation.isPending}
                      data-testid={`button-test-${config.id}`}
                    >
                      <TestTube className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={() => deleteMutation.mutate(config.id)}
                      data-testid={`button-delete-${config.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-4">
                    <Badge className={severityColors[config.severityThreshold]}>
                      Min Severity: {config.severityThreshold}
                    </Badge>
                    {config.emailRecipients.length > 0 && (
                      <span className="text-sm text-muted-foreground">
                        Recipients: {config.emailRecipients.join(", ")}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {config.alertTypes.map((type) => (
                      <Badge key={type} variant="secondary">
                        {type.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {notifsLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">Loading notifications...</CardContent>
            </Card>
          ) : notifications.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No notifications sent yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {notifications.map((notif) => (
                <Card key={notif.id} data-testid={`card-notification-${notif.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        {notif.channel === "email" ? (
                          <Mail className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Webhook className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">{notif.subject}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={statusColors[notif.status]}>
                          {notif.status === "sent" && <CheckCircle className="h-3 w-3 mr-1" />}
                          {notif.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                          {notif.status === "failed" && <XCircle className="h-3 w-3 mr-1" />}
                          {notif.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(notif.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">To: {notif.recipient}</p>
                    {notif.errorMessage && (
                      <p className="text-sm text-red-500 mt-1">Error: {notif.errorMessage}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
