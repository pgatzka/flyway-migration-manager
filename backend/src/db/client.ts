import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config.js';
import * as schema from './schema.js';

/** Raw postgres.js connection used by Drizzle */
const queryClient = postgres(config.databaseUrl);

/** Drizzle ORM client with schema for type-safe queries */
export const db = drizzle(queryClient, { schema });

/**
 * Runs the initial migration SQL to ensure all tables exist.
 * Uses IF NOT EXISTS so it's safe to run on every startup.
 */
export async function runMigrations(): Promise<void> {
  await queryClient.unsafe(`
    CREATE TABLE IF NOT EXISTS "projects" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" varchar(255) NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "projects_name_unique" UNIQUE("name")
    );

    CREATE TABLE IF NOT EXISTS "migrations" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
      "version" integer NOT NULL,
      "description" varchar(255) NOT NULL,
      "sql_content" text NOT NULL,
      "down_sql_content" text NOT NULL DEFAULT '',
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "uq_project_version" UNIQUE("project_id", "version")
    );

    -- Add down_sql_content column if it doesn't exist (for existing databases)
    DO $$ BEGIN
      ALTER TABLE "migrations" ADD COLUMN "down_sql_content" text NOT NULL DEFAULT '';
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS "validation_results" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
      "status" varchar(10) NOT NULL,
      "failed_migration_id" uuid REFERENCES "migrations"("id") ON DELETE SET NULL,
      "error_message" text,
      "log" text NOT NULL,
      "executed_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "webhooks" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
      "url" varchar(500) NOT NULL,
      "secret" varchar(255) NOT NULL DEFAULT '',
      "events" jsonb NOT NULL,
      "enabled" boolean NOT NULL DEFAULT true,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "webhook_id" uuid NOT NULL REFERENCES "webhooks"("id") ON DELETE CASCADE,
      "event" varchar(50) NOT NULL,
      "status_code" integer,
      "success" boolean NOT NULL,
      "delivered_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "annotations" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "migration_id" uuid NOT NULL REFERENCES "migrations"("id") ON DELETE CASCADE,
      "author" varchar(100) NOT NULL,
      "content" text NOT NULL,
      "line_number" integer,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "schema_snapshots" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "validation_result_id" uuid NOT NULL REFERENCES "validation_results"("id") ON DELETE CASCADE,
      "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
      "tables" jsonb NOT NULL,
      "captured_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `);
}

/**
 * Closes the database connection pool.
 * Called during graceful shutdown.
 */
export async function closeDb(): Promise<void> {
  await queryClient.end();
}
