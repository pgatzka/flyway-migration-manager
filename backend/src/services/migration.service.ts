import { eq, and, asc, gte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { migrations, projects } from '../db/schema.js';
import { NotFoundError, MigrationConflictError } from '../errors/index.js';
import type { Migration } from '../../../shared/types.js';
import pino from 'pino';

const logger = pino({ name: 'migration-service' });

/**
 * Converts a database migration row to an API response object.
 */
function toMigrationResponse(row: typeof migrations.$inferSelect): Migration {
  return {
    id: row.id,
    projectId: row.projectId,
    version: row.version,
    description: row.description,
    sqlContent: row.sqlContent,
    downSqlContent: row.downSqlContent,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Lists all migrations for a project, ordered by version ascending.
 * @param projectId - UUID of the project
 * @returns Array of migration records ordered by version
 */
export async function listMigrations(projectId: string): Promise<Migration[]> {
  logger.info({ projectId }, 'Listing migrations');

  const rows = await db
    .select()
    .from(migrations)
    .where(eq(migrations.projectId, projectId))
    .orderBy(asc(migrations.version));

  logger.info({ projectId, count: rows.length }, 'Listed migrations');
  return rows.map(toMigrationResponse);
}

/**
 * Creates a new migration with auto-generated version number.
 * The version is the highest existing version + 1, or 1 if no migrations exist.
 * @param projectId - UUID of the target project
 * @param description - Human-readable migration description
 * @param sqlContent - Raw SQL content of the migration
 * @returns The created migration record
 */
export async function createMigration(
  projectId: string,
  description: string,
  sqlContent: string
): Promise<Migration> {
  logger.info({ projectId, description }, 'Creating migration');

  // Verify project exists
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw new NotFoundError('Project', projectId);
  }

  // Find the next version number
  const existing = await db
    .select({ version: migrations.version })
    .from(migrations)
    .where(eq(migrations.projectId, projectId))
    .orderBy(asc(migrations.version));

  const nextVersion = existing.length > 0 ? existing[existing.length - 1].version + 1 : 1;

  logger.info({ projectId, version: nextVersion }, 'Auto-assigned version number');

  const [created] = await db
    .insert(migrations)
    .values({
      projectId,
      version: nextVersion,
      description,
      sqlContent,
    })
    .returning();

  // Update project's updatedAt timestamp
  await db
    .update(projects)
    .set({ updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  logger.info({ migrationId: created.id, projectId, version: nextVersion }, 'Migration created');
  return toMigrationResponse(created);
}

/**
 * Inserts a migration at a specific version, shifting existing migrations up.
 * All migrations with version >= targetVersion get their version incremented by 1.
 * @param projectId - UUID of the target project
 * @param targetVersion - Version number to insert at
 * @param description - Human-readable migration description
 * @param sqlContent - Raw SQL content of the migration
 * @returns The created migration record
 */
export async function insertMigrationAtVersion(
  projectId: string,
  targetVersion: number,
  description: string,
  sqlContent: string
): Promise<Migration> {
  logger.info({ projectId, targetVersion, description }, 'Inserting migration at version');

  // Verify project exists
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw new NotFoundError('Project', projectId);
  }

  // Shift existing migrations up to make room, starting from the highest
  // to avoid unique constraint violations
  const toShift = await db
    .select()
    .from(migrations)
    .where(and(eq(migrations.projectId, projectId), gte(migrations.version, targetVersion)))
    .orderBy(asc(migrations.version));

  // Shift from highest to lowest to avoid unique constraint collisions
  for (let i = toShift.length - 1; i >= 0; i--) {
    const m = toShift[i];
    await db
      .update(migrations)
      .set({ version: m.version + 1, updatedAt: new Date() })
      .where(eq(migrations.id, m.id));
  }

  logger.info(
    { projectId, shiftedCount: toShift.length, targetVersion },
    'Shifted existing migrations up'
  );

  // Insert the new migration at the target version
  const [created] = await db
    .insert(migrations)
    .values({
      projectId,
      version: targetVersion,
      description,
      sqlContent,
    })
    .returning();

  await db
    .update(projects)
    .set({ updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  logger.info({ migrationId: created.id, projectId, version: targetVersion }, 'Migration inserted');
  return toMigrationResponse(created);
}

/**
 * Retrieves a single migration by ID.
 * @param id - UUID of the migration
 * @returns The migration record
 * @throws NotFoundError if the migration does not exist
 */
export async function getMigration(id: string): Promise<Migration> {
  logger.info({ migrationId: id }, 'Fetching migration');

  const [row] = await db
    .select()
    .from(migrations)
    .where(eq(migrations.id, id))
    .limit(1);

  if (!row) {
    logger.warn({ migrationId: id }, 'Migration not found');
    throw new NotFoundError('Migration', id);
  }

  return toMigrationResponse(row);
}

/**
 * Updates a migration's description, SQL content, and/or version.
 * @param id - UUID of the migration to update
 * @param updates - Partial update fields
 * @returns The updated migration record
 * @throws NotFoundError if the migration does not exist
 * @throws MigrationConflictError if the new version conflicts with an existing migration
 */
export async function updateMigration(
  id: string,
  updates: { description?: string; sqlContent?: string; downSqlContent?: string; version?: number }
): Promise<Migration> {
  logger.info({ migrationId: id, updates: Object.keys(updates) }, 'Updating migration');

  const existing = await getMigration(id);

  // If version is being changed, check for conflicts
  if (updates.version !== undefined && updates.version !== existing.version) {
    const conflict = await db
      .select({ id: migrations.id })
      .from(migrations)
      .where(
        and(
          eq(migrations.projectId, existing.projectId),
          eq(migrations.version, updates.version)
        )
      )
      .limit(1);

    if (conflict.length > 0) {
      logger.warn(
        { migrationId: id, conflictVersion: updates.version },
        'Version conflict on update'
      );
      throw new MigrationConflictError(existing.projectId, updates.version);
    }
  }

  const [updated] = await db
    .update(migrations)
    .set({
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.sqlContent !== undefined && { sqlContent: updates.sqlContent }),
      ...(updates.downSqlContent !== undefined && { downSqlContent: updates.downSqlContent }),
      ...(updates.version !== undefined && { version: updates.version }),
      updatedAt: new Date(),
    })
    .where(eq(migrations.id, id))
    .returning();

  await db
    .update(projects)
    .set({ updatedAt: new Date() })
    .where(eq(projects.id, existing.projectId));

  logger.info({ migrationId: id }, 'Migration updated');
  return toMigrationResponse(updated);
}

/**
 * Deletes a migration by ID.
 * @param id - UUID of the migration to delete
 * @throws NotFoundError if the migration does not exist
 */
export async function deleteMigration(id: string): Promise<void> {
  logger.info({ migrationId: id }, 'Deleting migration');

  const existing = await getMigration(id);

  await db.delete(migrations).where(eq(migrations.id, id));

  await db
    .update(projects)
    .set({ updatedAt: new Date() })
    .where(eq(projects.id, existing.projectId));

  logger.info({ migrationId: id, projectId: existing.projectId }, 'Migration deleted');
}

/**
 * Renumbers all migrations in a project to close gaps.
 * Migrations are reordered sequentially starting from 1.
 * @param projectId - UUID of the project
 * @returns Array of updated migration records
 */
export async function renumberMigrations(projectId: string): Promise<Migration[]> {
  logger.info({ projectId }, 'Renumbering migrations');

  const existing = await db
    .select()
    .from(migrations)
    .where(eq(migrations.projectId, projectId))
    .orderBy(asc(migrations.version));

  if (existing.length === 0) {
    logger.info({ projectId }, 'No migrations to renumber');
    return [];
  }

  // First pass: move all to temporary high versions to avoid unique constraint issues
  const tempOffset = 100000;
  for (const m of existing) {
    await db
      .update(migrations)
      .set({ version: m.version + tempOffset })
      .where(eq(migrations.id, m.id));
  }

  // Second pass: assign sequential versions starting from 1
  const result: Migration[] = [];
  for (let i = 0; i < existing.length; i++) {
    const newVersion = i + 1;
    const [updated] = await db
      .update(migrations)
      .set({ version: newVersion, updatedAt: new Date() })
      .where(eq(migrations.id, existing[i].id))
      .returning();

    result.push(toMigrationResponse(updated));
  }

  await db
    .update(projects)
    .set({ updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  logger.info({ projectId, count: result.length }, 'Migrations renumbered');
  return result;
}
