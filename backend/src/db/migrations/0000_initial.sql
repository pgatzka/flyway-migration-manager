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
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "uq_project_version" UNIQUE("project_id", "version")
);

CREATE TABLE IF NOT EXISTS "validation_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "status" varchar(10) NOT NULL,
  "failed_migration_id" uuid REFERENCES "migrations"("id") ON DELETE SET NULL,
  "error_message" text,
  "log" text NOT NULL,
  "executed_at" timestamp with time zone DEFAULT now() NOT NULL
);
