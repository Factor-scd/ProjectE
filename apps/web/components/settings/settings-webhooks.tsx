'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, RotateCcw, Send, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';

// ── Types ──────────────────────────────────────────────────────────────────

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  secret?: string;
  domain?: string;
  retry_count: number;
  last_triggered_at?: string;
  created: string;
  updated: string;
}

interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  success: boolean;
  response_status: number;
  response_body: string;
  attempts: number;
  created: string;
}

const AVAILABLE_EVENTS = [
  '*',
  'task.completed',
  'habit.completed',
  'habit.streak_broken',
  'milestone.reached',
  'project.status_changed',
  'report.generated',
  'agent_task.completed',
];

// ── Webhook Delivery History ───────────────────────────────────────────────

function WebhookDeliveryHistory({ webhookId }: { webhookId?: string }) {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ perPage: '50', sort: '-created' });
      if (webhookId) params.set('webhook_id', webhookId);

      const response = await fetch(`/api/webhook-deliveries?${params}`);
      if (response.ok) {
        const data = await response.json();
        setDeliveries(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch deliveries:', error);
    } finally {
      setLoading(false);
    }
  }, [webhookId]);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  async function handleRetry(deliveryId: string) {
    setRetryingId(deliveryId);
    try {
      const response = await fetch(`/api/webhook-deliveries/${deliveryId}/retry`, {
        method: 'POST',
      });
      if (response.ok) {
        toast.success('Retry queued');
        fetchDeliveries();
      } else {
        const data = await response.json();
        toast.error(data.error?.message || 'Failed to queue retry');
      }
    } catch (error) {
      toast.error('Failed to queue retry');
    } finally {
      setRetryingId(null);
    }
  }

  if (loading) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">Loading delivery history...</p>
    );
  }

  if (deliveries.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No deliveries yet. Send a test event or trigger an event to see delivery history.
      </p>
    );
  }

  return (
    <ScrollArea className="max-h-[400px]">
      <div className="space-y-2">
        {deliveries.map((delivery) => (
          <div key={delivery.id} className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setExpandedId(expandedId === delivery.id ? null : delivery.id)}
                  className="flex items-center gap-1 text-sm font-medium hover:text-primary"
                  aria-expanded={expandedId === delivery.id}
                  aria-label={`${expandedId === delivery.id ? 'Collapse' : 'Expand'} details for ${delivery.event_type}`}
                >
                  {expandedId === delivery.id ? (
                    <ChevronDown className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-3 w-3" aria-hidden="true" />
                  )}
                  {delivery.event_type}
                </button>
                <Badge variant={delivery.success ? 'default' : 'destructive'}>
                  {delivery.success ? 'Success' : 'Failed'}
                </Badge>
                {delivery.response_status > 0 && (
                  <Badge variant="outline">{delivery.response_status}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {delivery.attempts} attempt{delivery.attempts !== 1 ? 's' : ''}
                </span>
                {!delivery.success && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRetry(delivery.id)}
                    disabled={retryingId === delivery.id}
                  >
                    {retryingId === delivery.id ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-1 h-3 w-3" />
                    )}
                    Retry
                  </Button>
                )}
              </div>
            </div>

            {expandedId === delivery.id && (
              <div className="mt-3 space-y-2 border-t pt-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Timestamp</Label>
                  <p className="text-sm">{new Date(delivery.created).toLocaleString()}</p>
                </div>
                {delivery.response_body && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Response</Label>
                    <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted p-2 text-xs">
                      {delivery.response_body}
                    </pre>
                  </div>
                )}
                <div>
                  <Label className="text-xs text-muted-foreground">Payload</Label>
                  <pre className="mt-1 max-h-32 overflow-auto rounded bg-muted p-2 text-xs">
                    {JSON.stringify(delivery.payload, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function SettingsWebhooks() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWebhookName, setNewWebhookName] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('webhooks');

  const fetchWebhooks = useCallback(async () => {
    try {
      const response = await fetch('/api/webhooks');
      if (response.ok) {
        const data = await response.json();
        setWebhooks(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch webhooks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  async function addWebhook() {
    if (!newWebhookName.trim() || !newWebhookUrl.trim()) return;

    try {
      const response = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newWebhookName,
          url: newWebhookUrl,
          events: ['*'],
          active: true,
          domain: 'default',
          retry_count: 3,
        }),
      });

      if (response.ok) {
        toast.success('Webhook created');
        setNewWebhookName('');
        setNewWebhookUrl('');
        setCreateDialogOpen(false);
        fetchWebhooks();
      } else {
        const data = await response.json();
        toast.error(data.error?.message || 'Failed to create webhook');
      }
    } catch (error) {
      toast.error('Failed to create webhook');
    }
  }

  async function toggleWebhook(webhook: Webhook) {
    try {
      const response = await fetch(`/api/webhooks/${webhook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !webhook.active }),
      });

      if (response.ok) {
        toast.success(webhook.active ? 'Webhook disabled' : 'Webhook enabled');
        fetchWebhooks();
      } else {
        toast.error('Failed to update webhook');
      }
    } catch (error) {
      toast.error('Failed to update webhook');
    }
  }

  async function deleteWebhook(id: string) {
    try {
      await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
      toast.success('Webhook deleted');
      setDeleteConfirmId(null);
      fetchWebhooks();
    } catch (error) {
      toast.error('Failed to delete webhook');
    }
  }

  async function testWebhook(id: string) {
    setTestingId(id);
    try {
      const response = await fetch(`/api/webhooks/${id}/test`, { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        toast.success(`Test delivery succeeded (${data.status})`);
      } else {
        toast.error(`Test delivery failed: ${data.response || 'Unknown error'}`);
      }
    } catch (error) {
      toast.error('Failed to send test event');
    } finally {
      setTestingId(null);
    }
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Webhooks</CardTitle>
              <CardDescription>
                Configure outbound webhooks for event notifications.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <TabsList>
                <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
                <TabsTrigger value="deliveries">Delivery History</TabsTrigger>
              </TabsList>
              {activeTab === 'webhooks' && (
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-1 h-4 w-4" />
                      New webhook
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Webhook</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="webhook-name">Name</Label>
                        <Input
                          id="webhook-name"
                          value={newWebhookName}
                          onChange={(e) => setNewWebhookName(e.target.value)}
                          placeholder="e.g., Slack notifications"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="webhook-url">URL</Label>
                        <Input
                          id="webhook-url"
                          value={newWebhookUrl}
                          onChange={(e) => setNewWebhookUrl(e.target.value)}
                          placeholder="https://example.com/webhook"
                        />
                      </div>
                      <Button onClick={addWebhook} className="w-full">
                        Create webhook
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TabsContent value="webhooks" className="mt-0">
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading webhooks...</p>
            ) : webhooks.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No webhooks configured. Click &quot;New webhook&quot; to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {webhooks.map((webhook) => (
                  <div key={webhook.id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{webhook.name}</h3>
                          <Badge variant={webhook.active ? 'default' : 'secondary'}>
                            {webhook.active ? 'Active' : 'Disabled'}
                          </Badge>
                        </div>
                        <p className="mt-1 font-mono text-sm text-muted-foreground">{webhook.url}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {webhook.events.slice(0, 4).map((event) => (
                            <Badge key={event} variant="outline" className="text-xs">
                              {event}
                            </Badge>
                          ))}
                          {webhook.events.length > 4 && (
                            <Badge variant="outline" className="text-xs">
                              +{webhook.events.length - 4} more
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={webhook.active}
                          onCheckedChange={() => toggleWebhook(webhook)}
                          aria-label={`Toggle ${webhook.name}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => testWebhook(webhook.id)}
                          disabled={testingId === webhook.id || !webhook.active}
                          aria-label={`Send test event to ${webhook.name}`}
                        >
                          {testingId === webhook.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirmId(webhook.id)}
                          aria-label={`Delete webhook: ${webhook.name}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="deliveries" className="mt-0">
            <WebhookDeliveryHistory />
          </TabsContent>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this webhook and all its delivery history. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && deleteWebhook(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Tabs>
  );
}
