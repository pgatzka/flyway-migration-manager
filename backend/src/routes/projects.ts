import { FastifyInstance } from 'fastify';
import * as projectService from '../services/project.service.js';
import type { CreateProjectRequest, UpdateProjectRequest } from '../../../shared/types.js';

/**
 * Registers project CRUD routes on the Fastify instance.
 * @param app - Fastify application instance
 */
export async function projectRoutes(app: FastifyInstance): Promise<void> {
  /** GET /api/projects — List all projects with dashboard stats */
  app.get('/api/projects', async (request, reply) => {
    app.log.info('GET /api/projects');
    const projects = await projectService.listProjectsWithStats();
    return reply.send(projects);
  });

  /** POST /api/projects — Create a new project */
  app.post<{ Body: CreateProjectRequest }>('/api/projects', async (request, reply) => {
    const { name } = request.body;
    app.log.info({ name }, 'POST /api/projects');

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Name is required', statusCode: 400 });
    }

    const project = await projectService.createProject(name.trim());
    return reply.status(201).send(project);
  });

  /** GET /api/projects/:id — Get a single project */
  app.get<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
    const { id } = request.params;
    app.log.info({ projectId: id }, 'GET /api/projects/:id');
    const project = await projectService.getProject(id);
    return reply.send(project);
  });

  /** PUT /api/projects/:id — Update a project's name */
  app.put<{ Params: { id: string }; Body: UpdateProjectRequest }>(
    '/api/projects/:id',
    async (request, reply) => {
      const { id } = request.params;
      const { name } = request.body;
      app.log.info({ projectId: id, name }, 'PUT /api/projects/:id');

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Name is required', statusCode: 400 });
      }

      const project = await projectService.updateProject(id, name.trim());
      return reply.send(project);
    }
  );

  /** POST /api/projects/:id/clone — Clone a project with all its migrations */
  app.post<{ Params: { id: string }; Body: { name: string } }>(
    '/api/projects/:id/clone',
    async (request, reply) => {
      const { id } = request.params;
      const { name } = request.body;
      app.log.info({ projectId: id, name }, 'POST /api/projects/:id/clone');

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Name for cloned project is required', statusCode: 400 });
      }

      const project = await projectService.cloneProject(id, name.trim());
      return reply.status(201).send(project);
    }
  );

  /** DELETE /api/projects/:id — Delete a project and all its data */
  app.delete<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
    const { id } = request.params;
    app.log.info({ projectId: id }, 'DELETE /api/projects/:id');
    await projectService.deleteProject(id);
    return reply.status(204).send();
  });
}
