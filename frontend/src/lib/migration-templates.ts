/**
 * Migration Templates Library — pre-built SQL templates for common patterns.
 * Pure data + functions, no React dependencies.
 */

export interface MigrationTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  sql: string;
}

export interface TemplateCategory {
  label: string;
  templates: MigrationTemplate[];
}

const templates: MigrationTemplate[] = [
  // ── Tables ──
  {
    id: 'users-table',
    name: 'Users Table',
    category: 'Tables',
    description: 'Standard users table with email, password hash, and timestamps.',
    sql: `CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users (email);`,
  },
  {
    id: 'audit-log-table',
    name: 'Audit Log Table',
    category: 'Tables',
    description: 'Generic audit log table for tracking changes to any entity.',
    sql: `CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name VARCHAR(100) NOT NULL,
  record_id VARCHAR(255) NOT NULL,
  action VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_values JSONB,
  new_values JSONB,
  changed_by VARCHAR(255),
  changed_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_table_record ON audit_log (table_name, record_id);
CREATE INDEX idx_audit_log_changed_at ON audit_log (changed_at);`,
  },
  {
    id: 'sessions-table',
    name: 'Sessions Table',
    category: 'Tables',
    description: 'Session management table for user authentication.',
    sql: `CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);`,
  },
  {
    id: 'tags-table',
    name: 'Tags (Many-to-Many)',
    category: 'Tables',
    description: 'Tags table with a junction table for many-to-many relationships.',
    sql: `CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Replace "items" with your target table name
CREATE TABLE item_tags (
  item_id UUID NOT NULL,
  tag_id INTEGER NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, tag_id)
);

CREATE INDEX idx_item_tags_tag_id ON item_tags (tag_id);`,
  },

  // ── Patterns ──
  {
    id: 'soft-delete',
    name: 'Add Soft Delete',
    category: 'Patterns',
    description: 'Adds deleted_at column and partial index for soft delete pattern.',
    sql: `-- Replace "your_table" with the actual table name
ALTER TABLE your_table ADD COLUMN deleted_at TIMESTAMP;

-- Partial index: queries on active records remain fast
CREATE INDEX idx_your_table_active ON your_table (id)
  WHERE deleted_at IS NULL;`,
  },
  {
    id: 'timestamps',
    name: 'Add Timestamps',
    category: 'Patterns',
    description: 'Adds created_at / updated_at columns with auto-update trigger.',
    sql: `-- Replace "your_table" with the actual table name
ALTER TABLE your_table
  ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT now(),
  ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT now();

-- Auto-update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_your_table_updated_at
  BEFORE UPDATE ON your_table
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();`,
  },
  {
    id: 'slug-column',
    name: 'Add URL Slug',
    category: 'Patterns',
    description: 'Adds a unique slug column for SEO-friendly URLs.',
    sql: `-- Replace "your_table" with the actual table name
ALTER TABLE your_table ADD COLUMN slug VARCHAR(255) NOT NULL DEFAULT '';

CREATE UNIQUE INDEX idx_your_table_slug ON your_table (slug)
  WHERE slug != '';`,
  },
  {
    id: 'full-text-search',
    name: 'Full-Text Search',
    category: 'Patterns',
    description: 'Adds a tsvector column and GIN index for full-text search.',
    sql: `-- Replace "your_table" and "your_column" with actual names
ALTER TABLE your_table ADD COLUMN search_vector tsvector;

UPDATE your_table SET search_vector = to_tsvector('english', coalesce(your_column, ''));

CREATE INDEX idx_your_table_search ON your_table USING GIN (search_vector);

-- Auto-update trigger
CREATE OR REPLACE FUNCTION update_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector = to_tsvector('english', coalesce(NEW.your_column, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_your_table_search
  BEFORE INSERT OR UPDATE ON your_table
  FOR EACH ROW
  EXECUTE FUNCTION update_search_vector();`,
  },

  // ── Security ──
  {
    id: 'rls-enable',
    name: 'Row-Level Security',
    category: 'Security',
    description: 'Enables RLS on a table with a basic policy for user ownership.',
    sql: `-- Replace "your_table" with the actual table name
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

-- Users can only see their own rows
CREATE POLICY user_isolation ON your_table
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::UUID);`,
  },
  {
    id: 'roles-permissions',
    name: 'Roles & Permissions',
    category: 'Security',
    description: 'Basic RBAC tables for roles and permissions.',
    sql: `CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions (id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  user_id UUID NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

INSERT INTO roles (name, description) VALUES
  ('admin', 'Full access'),
  ('user', 'Standard access'),
  ('viewer', 'Read-only access');`,
  },

  // ── Performance ──
  {
    id: 'table-partitioning',
    name: 'Table Partitioning',
    category: 'Performance',
    description: 'Creates a range-partitioned table by date (monthly).',
    sql: `-- Range partition by month
CREATE TABLE events (
  id BIGSERIAL,
  event_type VARCHAR(50) NOT NULL,
  payload JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Create partitions for current and next month
CREATE TABLE events_y2025_m01 PARTITION OF events
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE events_y2025_m02 PARTITION OF events
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- Index on the partitioned table
CREATE INDEX idx_events_created_at ON events (created_at);
CREATE INDEX idx_events_type ON events (event_type);`,
  },
  {
    id: 'materialized-view',
    name: 'Materialized View',
    category: 'Performance',
    description: 'Creates a materialized view with a unique index for concurrent refresh.',
    sql: `-- Replace with your actual query
CREATE MATERIALIZED VIEW mv_daily_stats AS
SELECT
  date_trunc('day', created_at)::DATE AS day,
  count(*) AS total_count
FROM your_table
GROUP BY day
ORDER BY day;

-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX idx_mv_daily_stats_day ON mv_daily_stats (day);

-- To refresh: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_stats;`,
  },

  // ── Enums & Types ──
  {
    id: 'status-enum',
    name: 'Status Enum',
    category: 'Enums & Types',
    description: 'Creates a common status enum type.',
    sql: `CREATE TYPE status AS ENUM ('draft', 'active', 'archived', 'deleted');

-- Usage: ALTER TABLE your_table ADD COLUMN status status NOT NULL DEFAULT 'draft';`,
  },
  {
    id: 'add-enum-value',
    name: 'Add Enum Value',
    category: 'Enums & Types',
    description: 'Adds a new value to an existing enum type.',
    sql: `-- Replace "your_enum" and 'new_value' with actual values
ALTER TYPE your_enum ADD VALUE 'new_value';

-- To add before/after a specific value:
-- ALTER TYPE your_enum ADD VALUE 'new_value' BEFORE 'existing_value';
-- ALTER TYPE your_enum ADD VALUE 'new_value' AFTER 'existing_value';`,
  },
];

/**
 * All templates grouped by category.
 */
export const TEMPLATE_CATEGORIES: TemplateCategory[] = (() => {
  const catMap = new Map<string, MigrationTemplate[]>();
  for (const t of templates) {
    const arr = catMap.get(t.category) || [];
    arr.push(t);
    catMap.set(t.category, arr);
  }
  return Array.from(catMap.entries()).map(([label, ts]) => ({ label, templates: ts }));
})();

/**
 * All templates as a flat list.
 */
export const ALL_TEMPLATES = templates;

/**
 * Find a template by ID.
 */
export function findTemplate(id: string): MigrationTemplate | undefined {
  return templates.find((t) => t.id === id);
}
