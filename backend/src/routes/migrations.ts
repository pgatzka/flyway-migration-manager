import { FastifyInstance } from 'fastify';
import * as migrationService from '../services/migration.service.js';
import type { CreateMigrationRequest, UpdateMigrationRequest } from '../../../shared/types.js';

/**
 * Registers migration CRUD routes on the Fastify instance.
 * @param app - Fastify application instance
 */
export async function migrationRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/projects/:id/migrations — List all migrations for a project */
  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/migrations',
    async (request, reply) => {
      const { id } = request.params;
      app.log.info({ projectId: id }, 'GET /api/projects/:id/migrations');
      const migrations = await migrationService.listMigrations(id);
      return reply.send(migrations);
    }
  );

  /** POST /api/projects/:id/migrations — Create a new migration (auto-version) */
  app.post<{ Params: { id: string }; Body: CreateMigrationRequest }>(
    '/api/projects/:id/migrations',
    async (request, reply) => {
      const { id } = request.params;
      const { description, sqlContent } = request.body;
      app.log.info({ projectId: id, description }, 'POST /api/projects/:id/migrations');

      if (!description || !sqlContent) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'description and sqlContent are required',
          statusCode: 400,
        });
      }

      const migration = await migrationService.createMigration(id, description.trim(), sqlContent);
      return reply.status(201).send(migration);
    }
  );

  /** POST /api/projects/:id/migrations/insert/:ver — Insert at specific version, shift others */
  app.post<{
    Params: { id: string; ver: string };
    Body: CreateMigrationRequest;
  }>('/api/projects/:id/migrations/insert/:ver', async (request, reply) => {
    const { id, ver } = request.params;
    const targetVersion = parseInt(ver, 10);
    const { description, sqlContent } = request.body;

    app.log.info(
      { projectId: id, targetVersion, description },
      'POST /api/projects/:id/migrations/insert/:ver'
    );

    if (isNaN(targetVersion) || targetVersion < 1) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Version must be a positive integer',
        statusCode: 400,
      });
    }

    if (!description || !sqlContent) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'description and sqlContent are required',
        statusCode: 400,
      });
    }

    const migration = await migrationService.insertMigrationAtVersion(
      id,
      targetVersion,
      description.trim(),
      sqlContent
    );
    return reply.status(201).send(migration);
  });

  /** GET /api/migrations/:id — Get a single migration */
  app.get<{ Params: { id: string } }>(
    '/api/migrations/:id',
    async (request, reply) => {
      const { id } = request.params;
      app.log.info({ migrationId: id }, 'GET /api/migrations/:id');
      const migration = await migrationService.getMigration(id);
      return reply.send(migration);
    }
  );

  /** PUT /api/migrations/:id — Update a migration */
  app.put<{ Params: { id: string }; Body: UpdateMigrationRequest }>(
    '/api/migrations/:id',
    async (request, reply) => {
      const { id } = request.params;
      const updates = request.body;
      app.log.info({ migrationId: id }, 'PUT /api/migrations/:id');

      const migration = await migrationService.updateMigration(id, updates);
      return reply.send(migration);
    }
  );

  /** DELETE /api/migrations/:id — Delete a migration */
  app.delete<{ Params: { id: string } }>(
    '/api/migrations/:id',
    async (request, reply) => {
      const { id } = request.params;
      app.log.info({ migrationId: id }, 'DELETE /api/migrations/:id');
      await migrationService.deleteMigration(id);
      return reply.status(204).send();
    }
  );

  /** POST /api/projects/:id/migrations/renumber — Renumber all migrations sequentially */
  app.post<{ Params: { id: string } }>(
    '/api/projects/:id/migrations/renumber',
    async (request, reply) => {
      const { id } = request.params;
      app.log.info({ projectId: id }, 'POST /api/projects/:id/migrations/renumber');
      const migrations = await migrationService.renumberMigrations(id);
      return reply.send(migrations);
    }
  );
}
