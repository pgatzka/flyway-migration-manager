import { FastifyInstance } from 'fastify';
import * as webhookService from '../services/webhook.service.js';
import type { UpsertWebhookRequest } from '../../../shared/types.js';

/**
 * Registers webhook configuration routes on the Fastify instance.
 */
export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/projects/:id/webhook — Get webhook config */
  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/webhook',
    async (request, reply) => {
      const { id } = request.params;
      const webhook = await webhookService.getWebhook(id);
      return reply.send(webhook);
    }
  );

  /** PUT /api/projects/:id/webhook — Create or update webhook config */
  app.put<{ Params: { id: string }; Body: UpsertWebhookRequest }>(
    '/api/projects/:id/webhook',
    async (request, reply) => {
      const { id } = request.params;
      const { url, events, enabled, secret } = request.body;

      if (!url || typeof url !== 'string') {
        return reply.status(400).send({ error: 'Bad Request', message: 'URL is required', statusCode: 400 });
      }
      if (!Array.isArray(events) || events.length === 0) {
        return reply.status(400).send({ error: 'Bad Request', message: 'At least one event is required', statusCode: 400 });
      }

      const webhook = await webhookService.upsertWebhook(id, url, events, enabled, secret);
      return reply.send(webhook);
    }
  );

  /** DELETE /api/projects/:id/webhook — Delete webhook config */
  app.delete<{ Params: { id: string } }>(
    '/api/projects/:id/webhook',
    async (request, reply) => {
      const { id } = request.params;
      await webhookService.deleteWebhook(id);
      return reply.status(204).send();
    }
  );

  /** GET /api/projects/:id/webhook/deliveries — List recent deliveries */
  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/webhook/deliveries',
    async (request, reply) => {
      const { id } = request.params;
      const deliveries = await webhookService.listDeliveries(id);
      return reply.send(deliveries);
    }
  );
}
