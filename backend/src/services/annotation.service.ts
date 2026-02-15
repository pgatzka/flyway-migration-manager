import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { annotations, migrations } from '../db/schema.js';
import { NotFoundError } from '../errors/index.js';
import type { Annotation } from '../../../shared/types.js';
import pino from 'pino';

const logger = pino({ name: 'annotation-service' });

function toResponse(row: typeof annotations.$inferSelect): Annotation {
  return {
    id: row.id,
    migrationId: row.migrationId,
    author: row.author,
    content: row.content,
    lineNumber: row.lineNumber,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Lists all annotations for a migration, newest first.
 */
export async function listAnnotations(migrationId: string): Promise<Annotation[]> {
  logger.info({ migrationId }, 'Listing annotations');
  const rows = await db
    .select()
    .from(annotations)
    .where(eq(annotations.migrationId, migrationId))
    .orderBy(desc(annotations.createdAt));
  return rows.map(toResponse);
}

/**
 * Creates a new annotation on a migration.
 */
export async function createAnnotation(
  migrationId: string,
  author: string,
  content: string,
  lineNumber?: number | null
): Promise<Annotation> {
  logger.info({ migrationId, author }, 'Creating annotation');

  // Verify migration exists
  const [mig] = await db
    .select({ id: migrations.id })
    .from(migrations)
    .where(eq(migrations.id, migrationId))
    .limit(1);
  if (!mig) throw new NotFoundError('Migration', migrationId);

  const [created] = await db
    .insert(annotations)
    .values({
      migrationId,
      author,
      content,
      lineNumber: lineNumber ?? null,
    })
    .returning();

  logger.info({ annotationId: created.id }, 'Annotation created');
  return toResponse(created);
}

/**
 * Deletes an annotation by ID.
 */
export async function deleteAnnotation(id: string): Promise<void> {
  logger.info({ annotationId: id }, 'Deleting annotation');
  const [existing] = await db
    .select({ id: annotations.id })
    .from(annotations)
    .where(eq(annotations.id, id))
    .limit(1);
  if (!existing) throw new NotFoundError('Annotation', id);
  await db.delete(annotations).where(eq(annotations.id, id));
  logger.info({ annotationId: id }, 'Annotation deleted');
}
