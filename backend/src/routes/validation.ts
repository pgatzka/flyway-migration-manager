import { FastifyInstance } from 'fastify';
import * as validationService from '../services/validation.service.js';

/**
 * Registers validation routes on the Fastify instance.
 * The validate endpoint uses Server-Sent Events (SSE) to stream progress.
 * @param app - Fastify application instance
 */
export async function validationRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/projects/:id/validate — Run validation with SSE streaming.
   * The response is an SSE stream that sends progress events for each migration
   * and a final completion event.
   */
  app.post<{ Params: { id: string } }>(
    '/api/projects/:id/validate',
    async (request, reply) => {
      const { id } = request.params;
      app.log.info({ projectId: id }, 'POST /api/projects/:id/validate — starting SSE validation');

      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      // Stream progress events as SSE
      const onProgress = (event: any) => {
        const data = JSON.stringify(event);
        reply.raw.write(`data: ${data}\n\n`);
      };

      try {
        await validationService.validateProject(id, onProgress);
      } catch (err: any) {
        app.log.error({ projectId: id, err: err.message }, 'Validation failed with error');
        const errorEvent = JSON.stringify({
          done: true,
          overallStatus: 'fail',
          error: err.message,
        });
        reply.raw.write(`data: ${errorEvent}\n\n`);
      } finally {
        reply.raw.end();
      }
    }
  );

  /** GET /api/projects/:id/validations — List past validation results */
  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/validations',
    async (request, reply) => {
      const { id } = request.params;
      app.log.info({ projectId: id }, 'GET /api/projects/:id/validations');
      const results = await validationService.listValidations(id);
      return reply.send(results);
    }
  );

  /** GET /api/projects/:id/schema — Get latest schema snapshot for ERD */
  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/schema',
    async (request, reply) => {
      const { id } = request.params;
      app.log.info({ projectId: id }, 'GET /api/projects/:id/schema');
      const snapshot = await validationService.getLatestSchemaSnapshot(id);
      if (!snapshot) {
        return reply.status(404).send({
          error: 'NotFound',
          message: 'No schema snapshot found. Run a successful validation first.',
          statusCode: 404,
        });
      }
      return reply.send(snapshot);
    }
  );

  /** GET /api/projects/:id/schemas — List all schema snapshots (summaries) */
  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/schemas',
    async (request, reply) => {
      const { id } = request.params;
      app.log.info({ projectId: id }, 'GET /api/projects/:id/schemas');
      const snapshots = await validationService.listSchemaSnapshots(id);
      return reply.send(snapshots);
    }
  );

  /** GET /api/schemas/:snapshotId — Get a specific schema snapshot */
  app.get<{ Params: { snapshotId: string } }>(
    '/api/schemas/:snapshotId',
    async (request, reply) => {
      const { snapshotId } = request.params;
      app.log.info({ snapshotId }, 'GET /api/schemas/:snapshotId');
      const snapshot = await validationService.getSchemaSnapshotById(snapshotId);
      return reply.send(snapshot);
    }
  );

  /** GET /api/schemas/:beforeId/compare/:afterId — Compare two snapshots */
  app.get<{ Params: { beforeId: string; afterId: string } }>(
    '/api/schemas/:beforeId/compare/:afterId',
    async (request, reply) => {
      const { beforeId, afterId } = request.params;
      app.log.info({ beforeId, afterId }, 'GET /api/schemas/:beforeId/compare/:afterId');
      const diff = await validationService.compareSchemaSnapshots(beforeId, afterId);
      return reply.send(diff);
    }
  );
}
