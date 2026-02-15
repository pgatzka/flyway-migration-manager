import { eq, asc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { migrations, projects } from '../db/schema.js';
import { NotFoundError, MigrationConflictError, BadRequestError } from '../errors/index.js';
import { parseFlywayFileName, generateFlywayFileName } from '../utils/flyway-naming.js';
import { createZipStream, type ZipEntry } from '../utils/zip.js';
import type { Migration } from '../../../shared/types.js';
import type { PassThrough } from 'stream';
import pino from 'pino';

const logger = pino({ name: 'import-export-service' });

/** Represents a parsed file ready for import */
interface ParsedImportFile {
  version: number;
  description: string;
  sqlContent: string;
  originalFileName: string;
}

/**
 * Imports multiple .sql files into a project by parsing Flyway naming conventions.
 * Rejects the entire batch if any version conflicts with existing migrations.
 * @param projectId - UUID of the target project
 * @param files - Array of file objects with name and content
 * @returns Array of created migration records
 * @throws NotFoundError if the project does not exist
 * @throws MigrationConflictError if any version already exists
 * @throws ImportParseError if any file name doesn't match the convention
 */
export async function importMigrations(
  projectId: string,
  files: { name: string; content: string }[]
): Promise<Migration[]> {
  logger.info({ projectId, fileCount: files.length }, 'Importing migration files');

  // Verify project exists
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw new NotFoundError('Project', projectId);
  }

  if (files.length === 0) {
    throw new BadRequestError('No files provided for import');
  }

  // Parse all files first — any parse failure rejects the batch
  const parsed: ParsedImportFile[] = files.map((file) => {
    logger.info({ projectId, file: file.name }, 'Parsing import file');
    const { version, description } = parseFlywayFileName(file.name);
    return {
      version,
      description,
      sqlContent: file.content,
      originalFileName: file.name,
    };
  });

  // Check for duplicate versions within the import batch itself
  const importVersions = parsed.map((p) => p.version);
  const uniqueVersions = new Set(importVersions);
  if (uniqueVersions.size !== importVersions.length) {
    const duplicates = importVersions.filter((v, i) => importVersions.indexOf(v) !== i);
    logger.warn({ projectId, duplicates }, 'Duplicate versions in import batch');
    throw new MigrationConflictError(projectId, duplicates[0]);
  }

  // Check for conflicts with existing migrations
  const existing = await db
    .select({ version: migrations.version })
    .from(migrations)
    .where(eq(migrations.projectId, projectId));

  const existingVersions = new Set(existing.map((m) => m.version));
  for (const p of parsed) {
    if (existingVersions.has(p.version)) {
      logger.warn(
        { projectId, version: p.version, file: p.originalFileName },
        'Version conflict during import'
      );
      throw new MigrationConflictError(projectId, p.version);
    }
  }

  // All checks passed — insert all migrations
  const created: Migration[] = [];
  for (const p of parsed) {
    const [row] = await db
      .insert(migrations)
      .values({
        projectId,
        version: p.version,
        description: p.description,
        sqlContent: p.sqlContent,
      })
      .returning();

    logger.info(
      { migrationId: row.id, projectId, version: p.version, file: p.originalFileName },
      'Migration imported'
    );

    created.push({
      id: row.id,
      projectId: row.projectId,
      version: row.version,
      description: row.description,
      sqlContent: row.sqlContent,
      downSqlContent: row.downSqlContent,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  await db
    .update(projects)
    .set({ updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  logger.info({ projectId, importedCount: created.length }, 'Import completed');
  return created;
}

/**
 * Exports all migrations in a project as a ZIP stream.
 * Files are named using Flyway convention: V{version}__{description}.sql
 * @param projectId - UUID of the project
 * @returns A readable stream containing the ZIP archive
 * @throws NotFoundError if the project does not exist
 */
export async function exportProjectAsZip(projectId: string): Promise<{ stream: PassThrough; projectName: string }> {
  logger.info({ projectId }, 'Exporting project as ZIP');

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw new NotFoundError('Project', projectId);
  }

  const allMigrations = await db
    .select()
    .from(migrations)
    .where(eq(migrations.projectId, projectId))
    .orderBy(asc(migrations.version));

  const entries: ZipEntry[] = allMigrations.map((m) => ({
    name: generateFlywayFileName(m.version, m.description),
    content: m.sqlContent,
  }));

  logger.info({ projectId, fileCount: entries.length }, 'Creating ZIP archive');
  const stream = createZipStream(entries);

  return { stream, projectName: project.name };
}

/**
 * Exports a single migration as a .sql file.
 * @param migrationId - UUID of the migration
 * @returns The file name and SQL content
 * @throws NotFoundError if the migration does not exist
 */
export async function exportMigration(migrationId: string): Promise<{ fileName: string; content: string }> {
  logger.info({ migrationId }, 'Exporting single migration');

  const [row] = await db
    .select()
    .from(migrations)
    .where(eq(migrations.id, migrationId))
    .limit(1);

  if (!row) {
    throw new NotFoundError('Migration', migrationId);
  }

  const fileName = generateFlywayFileName(row.version, row.description);
  logger.info({ migrationId, fileName }, 'Migration export ready');

  return { fileName, content: row.sqlContent };
}
