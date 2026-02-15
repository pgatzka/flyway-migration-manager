import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { webhooks, webhookDeliveries } from '../db/schema.js';
import { NotFoundError } from '../errors/index.js';
import type { WebhookConfig, WebhookDelivery } from '../../../shared/types.js';
import pino from 'pino';

const logger = pino({ name: 'webhook-service' });

function toWebhookResponse(row: typeof webhooks.$inferSelect): WebhookConfig {
  return {
    id: row.id,
    projectId: row.projectId,
    url: row.url,
    secret: row.secret,
    events: row.events as string[],
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
  };
}

function toDeliveryResponse(row: typeof webhookDeliveries.$inferSelect): WebhookDelivery {
  return {
    id: row.id,
    webhookId: row.webhookId,
    event: row.event,
    statusCode: row.statusCode,
    success: row.success,
    deliveredAt: row.deliveredAt.toISOString(),
  };
}

/** Get webhook config for a project */
export async function getWebhook(projectId: string): Promise<WebhookConfig | null> {
  const [row] = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.projectId, projectId))
    .limit(1);
  return row ? toWebhookResponse(row) : null;
}

/** Create or update webhook config for a project */
export async function upsertWebhook(
  projectId: string,
  url: string,
  events: string[],
  enabled: boolean,
  secret?: string
): Promise<WebhookConfig> {
  const existing = await getWebhook(projectId);

  if (existing) {
    const [updated] = await db
      .update(webhooks)
      .set({
        url,
        events,
        enabled,
        ...(secret !== undefined ? { secret } : {}),
      })
      .where(eq(webhooks.id, existing.id))
      .returning();
    logger.info({ webhookId: updated.id }, 'Webhook updated');
    return toWebhookResponse(updated);
  }

  const [created] = await db
    .insert(webhooks)
    .values({
      projectId,
      url,
      events,
      enabled,
      secret: secret || '',
    })
    .returning();

  logger.info({ webhookId: created.id, projectId }, 'Webhook created');
  return toWebhookResponse(created);
}

/** Delete webhook config for a project */
export async function deleteWebhook(projectId: string): Promise<void> {
  const existing = await getWebhook(projectId);
  if (!existing) throw new NotFoundError('Webhook', projectId);
  await db.delete(webhooks).where(eq(webhooks.id, existing.id));
  logger.info({ projectId }, 'Webhook deleted');
}

/** List recent webhook deliveries for a project */
export async function listDeliveries(projectId: string): Promise<WebhookDelivery[]> {
  const webhook = await getWebhook(projectId);
  if (!webhook) return [];

  const rows = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookId, webhook.id))
    .orderBy(desc(webhookDeliveries.deliveredAt))
    .limit(20);

  return rows.map(toDeliveryResponse);
}

/**
 * Fires a webhook for the given event, if configured and enabled.
 * Non-blocking — errors are logged but don't propagate.
 */
export async function fireWebhook(
  projectId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const webhook = await getWebhook(projectId);
  if (!webhook || !webhook.enabled) return;
  if (!webhook.events.includes(event)) return;

  logger.info({ projectId, event, url: webhook.url }, 'Firing webhook');

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (webhook.secret) {
      headers['X-Webhook-Secret'] = webhook.secret;
    }

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ event, timestamp: new Date().toISOString(), ...payload }),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    await db.insert(webhookDeliveries).values({
      webhookId: webhook.id,
      event,
      statusCode: response.status,
      success: response.ok,
    });

    logger.info({ statusCode: response.status, success: response.ok }, 'Webhook delivered');
  } catch (err: any) {
    await db.insert(webhookDeliveries).values({
      webhookId: webhook.id,
      event,
      statusCode: null,
      success: false,
    });
    logger.error({ err: err.message, event }, 'Webhook delivery failed');
  }
}
