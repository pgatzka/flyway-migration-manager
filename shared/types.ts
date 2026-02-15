/** UUID string type alias for clarity */
export type UUID = string;

/** Project record as returned by the API */
export interface Project {
  id: UUID;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** Project with dashboard statistics */
export interface ProjectWithStats extends Project {
  migrationCount: number;
  totalSqlLineCount: number;
  lastModified: string | null;
  lastValidation: ValidationResultSummary | null;
  validationPassCount: number;
  validationFailCount: number;
}

/** Migration record as returned by the API */
export interface Migration {
  id: UUID;
  projectId: UUID;
  version: number;
  description: string;
  sqlContent: string;
  downSqlContent: string;
  createdAt: string;
  updatedAt: string;
}

/** Validation result summary for dashboard display */
export interface ValidationResultSummary {
  id: UUID;
  status: 'pass' | 'fail';
  executedAt: string;
}

/** Full validation result record */
export interface ValidationResult {
  id: UUID;
  projectId: UUID;
  status: 'pass' | 'fail';
  failedMigrationId: UUID | null;
  errorMessage: string | null;
  log: string;
  executedAt: string;
}

/** SSE event sent during validation streaming */
export interface ValidationProgressEvent {
  migrationId: UUID;
  version: number;
  description: string;
  status: 'pending' | 'running' | 'pass' | 'fail';
  error?: string;
}

/** Final SSE event when validation completes */
export interface ValidationCompleteEvent {
  done: true;
  overallStatus: 'pass' | 'fail';
  validationResultId: UUID;
}

/** Union type for all SSE validation events */
export type ValidationSSEEvent = ValidationProgressEvent | ValidationCompleteEvent;

/** Request body for creating a project */
export interface CreateProjectRequest {
  name: string;
}

/** Request body for updating a project */
export interface UpdateProjectRequest {
  name: string;
}

/** Request body for creating a migration */
export interface CreateMigrationRequest {
  description: string;
  sqlContent: string;
}

/** Request body for updating a migration */
export interface UpdateMigrationRequest {
  description?: string;
  sqlContent?: string;
  downSqlContent?: string;
  version?: number;
}

/** Parsed Flyway file name components */
export interface FlywayFileName {
  version: number;
  description: string;
}

/** A column in a schema snapshot table */
export interface SchemaColumn {
  name: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
  isPrimaryKey: boolean;
}

/** A foreign key relationship */
export interface SchemaForeignKey {
  constraintName: string;
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
}

/** A table in a schema snapshot */
export interface SchemaTable {
  name: string;
  columns: SchemaColumn[];
  foreignKeys: SchemaForeignKey[];
}

/** Full schema snapshot captured after validation */
export interface SchemaSnapshot {
  id: UUID;
  validationResultId: UUID;
  projectId: UUID;
  tables: SchemaTable[];
  capturedAt: string;
}

/** Summary of a schema snapshot (without full table data) for listing */
export interface SchemaSnapshotSummary {
  id: UUID;
  validationResultId: UUID;
  projectId: UUID;
  tableCount: number;
  capturedAt: string;
}

/** Diff between two schema snapshots */
export interface SchemaDiff {
  addedTables: SchemaTable[];
  removedTables: SchemaTable[];
  modifiedTables: TableDiff[];
}

/** Diff for a single modified table */
export interface TableDiff {
  tableName: string;
  addedColumns: SchemaColumn[];
  removedColumns: SchemaColumn[];
  modifiedColumns: ColumnDiff[];
  addedForeignKeys: SchemaForeignKey[];
  removedForeignKeys: SchemaForeignKey[];
}

/** Diff for a single modified column */
export interface ColumnDiff {
  columnName: string;
  before: SchemaColumn;
  after: SchemaColumn;
}

/** An annotation/note on a migration */
export interface Annotation {
  id: UUID;
  migrationId: UUID;
  author: string;
  content: string;
  lineNumber: number | null;
  createdAt: string;
}

/** Webhook configuration for a project */
export interface WebhookConfig {
  id: UUID;
  projectId: UUID;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  createdAt: string;
}

/** Request body for creating/updating a webhook */
export interface UpsertWebhookRequest {
  url: string;
  secret?: string;
  events: string[];
  enabled: boolean;
}

/** Webhook delivery log entry */
export interface WebhookDelivery {
  id: UUID;
  webhookId: UUID;
  event: string;
  statusCode: number | null;
  success: boolean;
  deliveredAt: string;
}

/** Request body for creating an annotation */
export interface CreateAnnotationRequest {
  author: string;
  content: string;
  lineNumber?: number | null;
}

/** API error response shape */
export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}
