import { pgTable, uuid, varchar, text, integer, timestamp, unique, jsonb, boolean } from 'drizzle-orm/pg-core';

/** Projects table — each project represents a set of Flyway migrations */
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Migrations table — individual SQL migration files within a project */
export const migrations = pgTable(
  'migrations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    description: varchar('description', { length: 255 }).notNull(),
    sqlContent: text('sql_content').notNull(),
    downSqlContent: text('down_sql_content').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique('uq_project_version').on(table.projectId, table.version)]
);

/** Validation results table — records of migration validation runs */
export const validationResults = pgTable('validation_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 10 }).notNull().$type<'pass' | 'fail'>(),
  failedMigrationId: uuid('failed_migration_id').references(() => migrations.id, {
    onDelete: 'set null',
  }),
  errorMessage: text('error_message'),
  log: text('log').notNull(),
  executedAt: timestamp('executed_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Webhooks — CI/CD webhook configurations per project */
export const webhooks = pgTable('webhooks', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  url: varchar('url', { length: 500 }).notNull(),
  secret: varchar('secret', { length: 255 }).notNull().default(''),
  events: jsonb('events').notNull().$type<string[]>(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Webhook deliveries — log of webhook invocations */
export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: uuid('id').defaultRandom().primaryKey(),
  webhookId: uuid('webhook_id')
    .notNull()
    .references(() => webhooks.id, { onDelete: 'cascade' }),
  event: varchar('event', { length: 50 }).notNull(),
  statusCode: integer('status_code'),
  success: boolean('success').notNull(),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Annotations — notes attached to migrations for team collaboration */
export const annotations = pgTable('annotations', {
  id: uuid('id').defaultRandom().primaryKey(),
  migrationId: uuid('migration_id')
    .notNull()
    .references(() => migrations.id, { onDelete: 'cascade' }),
  author: varchar('author', { length: 100 }).notNull(),
  content: text('content').notNull(),
  lineNumber: integer('line_number'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Schema snapshots — captured database schema after a successful validation */
export const schemaSnapshots = pgTable('schema_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  validationResultId: uuid('validation_result_id')
    .notNull()
    .references(() => validationResults.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  tables: jsonb('tables').notNull().$type<any[]>(),
  capturedAt: timestamp('captured_at', { withTimezone: true }).defaultNow().notNull(),
});
