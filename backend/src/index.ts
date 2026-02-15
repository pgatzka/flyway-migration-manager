import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { closeDb, runMigrations } from './db/client.js';
import { projectRoutes } from './routes/projects.js';
import { migrationRoutes } from './routes/migrations.js';
import { importExportRoutes } from './routes/import-export.js';
import { validationRoutes } from './routes/validation.js';
import { annotationRoutes } from './routes/annotations.js';
import { webhookRoutes } from './routes/webhooks.js';
import { AppError } from './errors/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates and configures the Fastify application with all plugins and routes.
 * @returns Configured Fastify instance ready to listen
 */
async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.nodeEnv === 'production' ? 'info' : 'debug',
      transport:
        config.nodeEnv !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // Register plugins
  await app.register(cors, { origin: true });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max per file

  // Global error handler — logs the full error and returns a clean JSON response
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      app.log.warn(
        { err: error, statusCode: error.statusCode, path: request.url },
        error.message
      );
      return reply.status(error.statusCode).send({
        error: error.name,
        message: error.message,
        statusCode: error.statusCode,
      });
    }

    // Fastify validation errors
    const fastifyError = error as any;
    if (fastifyError.validation) {
      app.log.warn({ err: error, path: request.url }, 'Validation error');
      return reply.status(400).send({
        error: 'ValidationError',
        message: fastifyError.message,
        statusCode: 400,
      });
    }

    // Unexpected errors — always log the full stack trace
    app.log.error(
      { err: error, stack: (error as Error).stack, path: request.url },
      'Unhandled error'
    );
    return reply.status(500).send({
      error: 'InternalServerError',
      message: 'An unexpected error occurred',
      statusCode: 500,
    });
  });

  // Register API routes
  await app.register(projectRoutes);
  await app.register(migrationRoutes);
  await app.register(importExportRoutes);
  await app.register(validationRoutes);
  await app.register(annotationRoutes);
  await app.register(webhookRoutes);

  // In production, serve the frontend static files
  const frontendDistPath = path.join(__dirname, '../../frontend/dist');
  try {
    await app.register(fastifyStatic, {
      root: frontendDistPath,
      prefix: '/',
      wildcard: false,
    });

    // SPA fallback: serve index.html for non-API routes
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.status(404).send({
          error: 'NotFound',
          message: `Route ${request.method} ${request.url} not found`,
          statusCode: 404,
        });
      }
      return reply.sendFile('index.html');
    });
  } catch {
    // Frontend dist may not exist during development
    app.log.info('Frontend dist not found, running in API-only mode');

    app.setNotFoundHandler((request, reply) => {
      return reply.status(404).send({
        error: 'NotFound',
        message: `Route ${request.method} ${request.url} not found`,
        statusCode: 404,
      });
    });
  }

  return app;
}

/**
 * Starts the HTTP server and registers graceful shutdown handlers.
 */
async function start() {
  const app = await buildApp();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Received shutdown signal');
    await app.close();
    await closeDb();
    app.log.info('Server shut down gracefully');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    // Run database migrations on startup to ensure tables exist
    app.log.info('Running database migrations...');
    await runMigrations();
    app.log.info('Database migrations completed');

    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info({ port: config.port }, 'Server started');
  } catch (err) {
    app.log.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

start();
