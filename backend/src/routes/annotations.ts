import { FastifyInstance } from 'fastify';
import * as annotationService from '../services/annotation.service.js';
import type { CreateAnnotationRequest } from '../../../shared/types.js';

/**
 * Registers annotation routes on the Fastify instance.
 */
export async function annotationRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/migrations/:id/annotations — List annotations for a migration */
  app.get<{ Params: { id: string } }>(
    '/api/migrations/:id/annotations',
    async (request, reply) => {
      const { id } = request.params;
      const annotations = await annotationService.listAnnotations(id);
      return reply.send(annotations);
    }
  );

  /** POST /api/migrations/:id/annotations — Create an annotation */
  app.post<{ Params: { id: string }; Body: CreateAnnotationRequest }>(
    '/api/migrations/:id/annotations',
    async (request, reply) => {
      const { id } = request.params;
      const { author, content, lineNumber } = request.body;

      if (!author || typeof author !== 'string' || author.trim().length === 0) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Author is required', statusCode: 400 });
      }
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Content is required', statusCode: 400 });
      }

      const annotation = await annotationService.createAnnotation(
        id,
        author.trim(),
        content.trim(),
        lineNumber
      );
      return reply.status(201).send(annotation);
    }
  );

  /** DELETE /api/annotations/:id — Delete an annotation */
  app.delete<{ Params: { id: string } }>(
    '/api/annotations/:id',
    async (request, reply) => {
      const { id } = request.params;
      await annotationService.deleteAnnotation(id);
      return reply.status(204).send();
    }
  );
}
