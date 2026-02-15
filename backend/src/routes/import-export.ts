import { FastifyInstance } from 'fastify';
import * as importExportService from '../services/import-export.service.js';

/**
 * Registers import/export routes on the Fastify instance.
 * @param app - Fastify application instance
 */
export async function importExportRoutes(app: FastifyInstance): Promise<void> {
  /** POST /api/projects/:id/import — Upload .sql files (multipart) */
  app.post<{ Params: { id: string } }>(
    '/api/projects/:id/import',
    async (request, reply) => {
      const { id } = request.params;
      app.log.info({ projectId: id }, 'POST /api/projects/:id/import');

      const parts = request.parts();
      const files: { name: string; content: string }[] = [];

      for await (const part of parts) {
        if (part.type === 'file') {
          const content = await part.toBuffer();
          files.push({
            name: part.filename,
            content: content.toString('utf-8'),
          });
          app.log.info(
            { projectId: id, fileName: part.filename, size: content.length },
            'Received file for import'
          );
        }
      }

      const imported = await importExportService.importMigrations(id, files);
      return reply.status(201).send(imported);
    }
  );

  /** GET /api/projects/:id/export — Download all migrations as ZIP */
  app.get<{ Params: { id: string } }>(
    '/api/projects/:id/export',
    async (request, reply) => {
      const { id } = request.params;
      app.log.info({ projectId: id }, 'GET /api/projects/:id/export');

      const { stream, projectName } = await importExportService.exportProjectAsZip(id);
      const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');

      return reply
        .header('Content-Type', 'application/zip')
        .header('Content-Disposition', `attachment; filename="${safeName}_migrations.zip"`)
        .send(stream);
    }
  );

  /** GET /api/migrations/:id/export — Download a single migration as .sql */
  app.get<{ Params: { id: string } }>(
    '/api/migrations/:id/export',
    async (request, reply) => {
      const { id } = request.params;
      app.log.info({ migrationId: id }, 'GET /api/migrations/:id/export');

      const { fileName, content } = await importExportService.exportMigration(id);

      return reply
        .header('Content-Type', 'application/sql')
        .header('Content-Disposition', `attachment; filename="${fileName}"`)
        .send(content);
    }
  );
}
