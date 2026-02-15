import { eq, asc, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { migrations, validationResults, projects, schemaSnapshots } from '../db/schema.js';
import { NotFoundError } from '../errors/index.js';
import { fireWebhook } from './webhook.service.js';
import type { ValidationResult, ValidationProgressEvent, ValidationCompleteEvent, SchemaTable, SchemaColumn, SchemaForeignKey, SchemaSnapshot, SchemaSnapshotSummary, SchemaDiff, TableDiff, ColumnDiff } from '../../../shared/types.js';
import pino from 'pino';

const logger = pino({ name: 'validation-service' });

/** Callback type for streaming validation progress events */
export type ProgressCallback = (event: ValidationProgressEvent | ValidationCompleteEvent) => void;

/**
 * Introspects the database schema from a temporary PostgreSQL instance.
 * Queries information_schema to extract tables, columns, and foreign keys.
 */
async function introspectSchema(tempSql: any): Promise<SchemaTable[]> {
  // Get all user tables (exclude system schemas)
  const tables = await tempSql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;

  const result: SchemaTable[] = [];

  for (const table of tables) {
    const tableName = table.table_name;

    // Get columns
    const columns = await tempSql`
      SELECT
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_primary_key
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT ku.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage ku
          ON tc.constraint_name = ku.constraint_name
          AND tc.table_schema = ku.table_schema
        WHERE tc.table_name = ${tableName}
          AND tc.table_schema = 'public'
          AND tc.constraint_type = 'PRIMARY KEY'
      ) pk ON pk.column_name = c.column_name
      WHERE c.table_name = ${tableName} AND c.table_schema = 'public'
      ORDER BY c.ordinal_position
    `;

    // Get foreign keys
    const foreignKeys = await tempSql`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS referenced_table,
        ccu.column_name AS referenced_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema = ccu.table_schema
      WHERE tc.table_name = ${tableName}
        AND tc.table_schema = 'public'
        AND tc.constraint_type = 'FOREIGN KEY'
    `;

    result.push({
      name: tableName,
      columns: columns.map((col: any): SchemaColumn => ({
        name: col.column_name,
        dataType: col.data_type,
        isNullable: col.is_nullable === 'YES',
        columnDefault: col.column_default,
        isPrimaryKey: col.is_primary_key,
      })),
      foreignKeys: foreignKeys.map((fk: any): SchemaForeignKey => ({
        constraintName: fk.constraint_name,
        columnName: fk.column_name,
        referencedTable: fk.referenced_table,
        referencedColumn: fk.referenced_column,
      })),
    });
  }

  return result;
}

/**
 * Runs all migrations for a project against a temporary PostgreSQL database.
 * Uses Testcontainers to spin up an ephemeral PostgreSQL instance.
 * Streams progress events via the provided callback.
 * @param projectId - UUID of the project to validate
 * @param onProgress - Callback invoked for each migration's result and on completion
 * @returns The saved validation result record
 * @throws NotFoundError if the project does not exist
 */
export async function validateProject(
  projectId: string,
  onProgress: ProgressCallback
): Promise<ValidationResult> {
  logger.info({ projectId }, 'Starting validation');

  // Verify project exists
  const [project] = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw new NotFoundError('Project', projectId);
  }

  // Fetch all migrations ordered by version
  const allMigrations = await db
    .select()
    .from(migrations)
    .where(eq(migrations.projectId, projectId))
    .orderBy(asc(migrations.version));

  logger.info(
    { projectId, migrationCount: allMigrations.length },
    'Fetched migrations for validation'
  );

  // Send initial pending state for all migrations
  for (const m of allMigrations) {
    onProgress({
      migrationId: m.id,
      version: m.version,
      description: m.description,
      status: 'pending',
    });
  }

  let overallStatus: 'pass' | 'fail' = 'pass';
  let failedMigrationId: string | null = null;
  let errorMessage: string | null = null;
  let capturedSchema: SchemaTable[] | null = null;
  const logLines: string[] = [];

  // Dynamically import testcontainers to avoid issues in environments without Docker
  let PostgreSqlContainer: any;
  try {
    const tc = await import('@testcontainers/postgresql');
    PostgreSqlContainer = tc.PostgreSqlContainer;
  } catch (err) {
    logger.error({ err }, 'Failed to import @testcontainers/postgresql');
    throw new Error('Testcontainers is not available. Ensure Docker is running.');
  }

  let container: any = null;

  try {
    logLines.push('Starting temporary PostgreSQL container...');
    logger.info({ projectId }, 'Starting Testcontainers PostgreSQL instance');

    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    const connectionUri = container.getConnectionUri();
    logLines.push(`Container started: ${connectionUri}`);
    logger.info({ projectId, connectionUri }, 'Testcontainers PostgreSQL started');

    // Connect to the temporary database using postgres.js
    const { default: postgres } = await import('postgres');
    const tempSql = postgres(connectionUri);

    try {
      // Execute each migration in order
      for (const m of allMigrations) {
        logger.info(
          { projectId, migrationId: m.id, version: m.version },
          'Executing migration'
        );

        onProgress({
          migrationId: m.id,
          version: m.version,
          description: m.description,
          status: 'running',
        });

        logLines.push(`Running V${m.version}__${m.description}...`);

        try {
          await tempSql.unsafe(m.sqlContent);

          logLines.push(`  ✓ V${m.version} passed`);
          logger.info(
            { projectId, migrationId: m.id, version: m.version },
            'Migration passed validation'
          );

          onProgress({
            migrationId: m.id,
            version: m.version,
            description: m.description,
            status: 'pass',
          });
        } catch (err: any) {
          const errMsg = err.message || String(err);
          logLines.push(`  ✗ V${m.version} FAILED: ${errMsg}`);
          logger.error(
            { projectId, migrationId: m.id, version: m.version, err: errMsg },
            'Migration failed validation'
          );

          overallStatus = 'fail';
          failedMigrationId = m.id;
          errorMessage = errMsg;

          onProgress({
            migrationId: m.id,
            version: m.version,
            description: m.description,
            status: 'fail',
            error: errMsg,
          });

          // Stop on first failure
          break;
        }
      }

      // If all migrations passed, introspect schema before closing connection
      if (overallStatus === 'pass') {
        try {
          logLines.push('Capturing schema snapshot...');
          capturedSchema = await introspectSchema(tempSql);
          logLines.push(`Captured ${capturedSchema.length} table(s).`);
        } catch (err: any) {
          logLines.push(`Warning: Failed to capture schema: ${err.message}`);
          logger.warn({ projectId, err: err.message }, 'Schema introspection failed');
        }
      }
    } finally {
      await tempSql.end();
    }
  } catch (err: any) {
    // Container-level or unexpected errors
    if (!errorMessage) {
      const errMsg = err.message || String(err);
      logLines.push(`Container error: ${errMsg}`);
      logger.error({ projectId, err: errMsg }, 'Validation container error');
      overallStatus = 'fail';
      errorMessage = errMsg;
    }
  } finally {
    if (container) {
      try {
        logLines.push('Stopping container...');
        await container.stop();
        logLines.push('Container stopped.');
        logger.info({ projectId }, 'Testcontainers PostgreSQL stopped');
      } catch (err: any) {
        logger.error({ projectId, err: err.message }, 'Failed to stop container');
        logLines.push(`Warning: Failed to stop container: ${err.message}`);
      }
    }
  }

  const fullLog = logLines.join('\n');

  logLines.push(`\nValidation result: ${overallStatus.toUpperCase()}`);

  // Save the result
  const [savedResult] = await db
    .insert(validationResults)
    .values({
      projectId,
      status: overallStatus,
      failedMigrationId,
      errorMessage,
      log: fullLog,
    })
    .returning();

  logger.info(
    { projectId, validationResultId: savedResult.id, status: overallStatus },
    'Validation result saved'
  );

  // Save schema snapshot if captured
  if (capturedSchema) {
    try {
      await db
        .insert(schemaSnapshots)
        .values({
          validationResultId: savedResult.id,
          projectId,
          tables: capturedSchema,
        });
      logger.info({ projectId, validationResultId: savedResult.id }, 'Schema snapshot saved');
    } catch (err: any) {
      logger.error({ projectId, err: err.message }, 'Failed to save schema snapshot');
    }
  }

  // Send completion event
  onProgress({
    done: true,
    overallStatus,
    validationResultId: savedResult.id,
  });

  // Fire webhook (non-blocking)
  fireWebhook(projectId, 'validation.completed', {
    projectId,
    validationResultId: savedResult.id,
    status: overallStatus,
    errorMessage,
  }).catch(() => {}); // Swallow errors — webhooks are best-effort

  return {
    id: savedResult.id,
    projectId: savedResult.projectId,
    status: savedResult.status as 'pass' | 'fail',
    failedMigrationId: savedResult.failedMigrationId,
    errorMessage: savedResult.errorMessage,
    log: savedResult.log,
    executedAt: savedResult.executedAt.toISOString(),
  };
}

/**
 * Gets the latest schema snapshot for a project.
 * @param projectId - UUID of the project
 * @returns The latest schema snapshot, or null if none exists
 */
export async function getLatestSchemaSnapshot(projectId: string): Promise<SchemaSnapshot | null> {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw new NotFoundError('Project', projectId);
  }

  const [snapshot] = await db
    .select()
    .from(schemaSnapshots)
    .where(eq(schemaSnapshots.projectId, projectId))
    .orderBy(desc(schemaSnapshots.capturedAt))
    .limit(1);

  if (!snapshot) return null;

  return {
    id: snapshot.id,
    validationResultId: snapshot.validationResultId,
    projectId: snapshot.projectId,
    tables: snapshot.tables as SchemaTable[],
    capturedAt: snapshot.capturedAt.toISOString(),
  };
}

/**
 * Lists all past validation results for a project, newest first.
 * @param projectId - UUID of the project
 * @returns Array of validation result records
 */
export async function listValidations(projectId: string): Promise<ValidationResult[]> {
  logger.info({ projectId }, 'Listing validation results');

  // Verify project exists
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw new NotFoundError('Project', projectId);
  }

  const rows = await db
    .select()
    .from(validationResults)
    .where(eq(validationResults.projectId, projectId))
    .orderBy(desc(validationResults.executedAt));

  logger.info({ projectId, count: rows.length }, 'Listed validation results');

  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    status: r.status as 'pass' | 'fail',
    failedMigrationId: r.failedMigrationId,
    errorMessage: r.errorMessage,
    log: r.log,
    executedAt: r.executedAt.toISOString(),
  }));
}

/**
 * Lists all schema snapshots for a project (summaries without full table data).
 * @param projectId - UUID of the project
 * @returns Array of snapshot summaries, newest first
 */
export async function listSchemaSnapshots(projectId: string): Promise<SchemaSnapshotSummary[]> {
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw new NotFoundError('Project', projectId);
  }

  const rows = await db
    .select()
    .from(schemaSnapshots)
    .where(eq(schemaSnapshots.projectId, projectId))
    .orderBy(desc(schemaSnapshots.capturedAt));

  return rows.map((r) => ({
    id: r.id,
    validationResultId: r.validationResultId,
    projectId: r.projectId,
    tableCount: (r.tables as SchemaTable[]).length,
    capturedAt: r.capturedAt.toISOString(),
  }));
}

/**
 * Gets a specific schema snapshot by ID.
 * @param snapshotId - UUID of the snapshot
 * @returns Full schema snapshot with tables
 */
export async function getSchemaSnapshotById(snapshotId: string): Promise<SchemaSnapshot> {
  const [snapshot] = await db
    .select()
    .from(schemaSnapshots)
    .where(eq(schemaSnapshots.id, snapshotId))
    .limit(1);

  if (!snapshot) {
    throw new NotFoundError('SchemaSnapshot', snapshotId);
  }

  return {
    id: snapshot.id,
    validationResultId: snapshot.validationResultId,
    projectId: snapshot.projectId,
    tables: snapshot.tables as SchemaTable[],
    capturedAt: snapshot.capturedAt.toISOString(),
  };
}

/**
 * Compares two schema snapshots and returns the diff.
 * @param beforeId - UUID of the older snapshot
 * @param afterId - UUID of the newer snapshot
 * @returns Schema diff showing added, removed, and modified tables
 */
export async function compareSchemaSnapshots(beforeId: string, afterId: string): Promise<SchemaDiff> {
  const [before, after] = await Promise.all([
    getSchemaSnapshotById(beforeId),
    getSchemaSnapshotById(afterId),
  ]);

  return diffSchemas(before.tables, after.tables);
}

function diffSchemas(before: SchemaTable[], after: SchemaTable[]): SchemaDiff {
  const beforeMap = new Map(before.map((t) => [t.name, t]));
  const afterMap = new Map(after.map((t) => [t.name, t]));

  const addedTables: SchemaTable[] = [];
  const removedTables: SchemaTable[] = [];
  const modifiedTables: TableDiff[] = [];

  // Find added and modified tables
  for (const [name, afterTable] of afterMap) {
    const beforeTable = beforeMap.get(name);
    if (!beforeTable) {
      addedTables.push(afterTable);
    } else {
      const tableDiff = diffTable(name, beforeTable, afterTable);
      if (tableDiff) {
        modifiedTables.push(tableDiff);
      }
    }
  }

  // Find removed tables
  for (const [name, beforeTable] of beforeMap) {
    if (!afterMap.has(name)) {
      removedTables.push(beforeTable);
    }
  }

  return { addedTables, removedTables, modifiedTables };
}

function diffTable(tableName: string, before: SchemaTable, after: SchemaTable): TableDiff | null {
  const beforeColMap = new Map(before.columns.map((c) => [c.name, c]));
  const afterColMap = new Map(after.columns.map((c) => [c.name, c]));

  const addedColumns: SchemaColumn[] = [];
  const removedColumns: SchemaColumn[] = [];
  const modifiedColumns: ColumnDiff[] = [];

  for (const [name, afterCol] of afterColMap) {
    const beforeCol = beforeColMap.get(name);
    if (!beforeCol) {
      addedColumns.push(afterCol);
    } else if (
      beforeCol.dataType !== afterCol.dataType ||
      beforeCol.isNullable !== afterCol.isNullable ||
      beforeCol.columnDefault !== afterCol.columnDefault ||
      beforeCol.isPrimaryKey !== afterCol.isPrimaryKey
    ) {
      modifiedColumns.push({ columnName: name, before: beforeCol, after: afterCol });
    }
  }

  for (const [name] of beforeColMap) {
    if (!afterColMap.has(name)) {
      removedColumns.push(beforeColMap.get(name)!);
    }
  }

  // Foreign keys
  const beforeFkMap = new Map(before.foreignKeys.map((fk) => [fk.constraintName, fk]));
  const afterFkMap = new Map(after.foreignKeys.map((fk) => [fk.constraintName, fk]));

  const addedForeignKeys = after.foreignKeys.filter((fk) => !beforeFkMap.has(fk.constraintName));
  const removedForeignKeys = before.foreignKeys.filter((fk) => !afterFkMap.has(fk.constraintName));

  if (
    addedColumns.length === 0 &&
    removedColumns.length === 0 &&
    modifiedColumns.length === 0 &&
    addedForeignKeys.length === 0 &&
    removedForeignKeys.length === 0
  ) {
    return null;
  }

  return { tableName, addedColumns, removedColumns, modifiedColumns, addedForeignKeys, removedForeignKeys };
}
