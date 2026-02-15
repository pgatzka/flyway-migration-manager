import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import * as api from '@/api/client';
import type { WebhookConfig, WebhookDelivery } from '@shared/types';
import { ArrowLeft, Webhook, Save, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';

const AVAILABLE_EVENTS = [
  { id: 'validation.completed', label: 'Validation Completed', description: 'Fired when a validation run finishes (pass or fail)' },
];

/**
 * Webhook settings page for configuring CI/CD webhook integration.
 */
export function WebhookSettingsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [webhook, setWebhook] = useState<WebhookConfig | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);

  // Form state
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [events, setEvents] = useState<string[]>(['validation.completed']);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    Promise.all([
      api.getWebhook(projectId),
      api.listWebhookDeliveries(projectId),
    ])
      .then(([wh, dels]) => {
        if (wh) {
          setWebhook(wh);
          setUrl(wh.url);
          setSecret(wh.secret);
          setEvents(wh.events);
          setEnabled(wh.enabled);
        }
        setDeliveries(dels);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleSave = async () => {
    if (!projectId || !url.trim()) return;
    try {
      setSaving(true);
      const saved = await api.upsertWebhook(projectId, {
        url: url.trim(),
        secret: secret.trim(),
        events,
        enabled,
      });
      setWebhook(saved);
      toast({ title: 'Webhook saved' });
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!projectId) return;
    try {
      await api.deleteWebhook(projectId);
      setWebhook(null);
      setUrl('');
      setSecret('');
      setEvents(['validation.completed']);
      setEnabled(true);
      toast({ title: 'Webhook deleted' });
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
  };

  const toggleEvent = (eventId: string) => {
    setEvents((prev) =>
      prev.includes(eventId) ? prev.filter((e) => e !== eventId) : [...prev, eventId]
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link to={`/projects/${projectId}`}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Project
          </Link>
        </Button>

        <div className="flex items-center gap-3">
          <Webhook className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Webhook Settings</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure a webhook to receive notifications when events occur in this project.
        </p>
      </div>

      {/* Config form */}
      <div className="space-y-4 rounded-lg border p-6">
        <div>
          <Label htmlFor="webhook-url">Webhook URL</Label>
          <Input
            id="webhook-url"
            placeholder="https://example.com/webhook"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="webhook-secret">Secret (optional)</Label>
          <Input
            id="webhook-secret"
            placeholder="Shared secret for verification"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="mt-1"
            type="password"
          />
          <p className="text-xs text-muted-foreground mt-1">
            If set, sent as X-Webhook-Secret header for request verification.
          </p>
        </div>

        <div>
          <Label>Events</Label>
          <div className="mt-2 space-y-2">
            {AVAILABLE_EVENTS.map((evt) => (
              <label key={evt.id} className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  checked={events.includes(evt.id)}
                  onCheckedChange={() => toggleEvent(evt.id)}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium text-foreground">{evt.label}</div>
                  <div className="text-xs text-muted-foreground">{evt.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={enabled}
            onCheckedChange={(checked) => setEnabled(checked === true)}
          />
          <span className="text-sm font-medium text-foreground">Enabled</span>
        </label>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving || !url.trim()}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Webhook'}
          </Button>
          {webhook && (
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Delivery log */}
      {deliveries.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-3">Recent Deliveries</h3>
          <div className="rounded-lg border divide-y">
            {deliveries.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                {d.success ? (
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                )}
                <span className="font-mono text-xs text-muted-foreground w-20">
                  {d.statusCode || 'ERR'}
                </span>
                <span className="text-foreground">{d.event}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDate(d.deliveredAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
