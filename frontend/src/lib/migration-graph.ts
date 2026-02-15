/**
 * Migration Dependency Graph — analyzes SQL to extract table references
 * and build a dependency graph between migrations.
 * Pure functions, no React dependencies.
 */

import type { Migration } from '@shared/types';

/** A table reference extracted from a migration's SQL */
export interface TableRef {
  table: string;
  action: 'create' | 'drop' | 'alter' | 'read' | 'write';
}

/** A node in the dependency graph */
export interface MigrationNode {
  migrationId: string;
  version: number;
  description: string;
  tables: TableRef[];
  riskLevel: 'safe' | 'caution' | 'destructive';
}

/** An edge representing a dependency between two migrations */
export interface MigrationEdge {
  from: string; // migrationId
  to: string;   // migrationId
  table: string; // shared table
  type: 'creates-for' | 'modifies-after' | 'drops-created';
}

/** Full dependency graph */
export interface DependencyGraph {
  nodes: MigrationNode[];
  edges: MigrationEdge[];
  tableOwners: Map<string, string[]>; // table → migrationIds that touch it
}

/**
 * Extracts table references from a SQL string.
 * Identifies CREATE TABLE, DROP TABLE, ALTER TABLE, INSERT, UPDATE, DELETE, SELECT.
 */
export function extractTableRefs(sql: string): TableRef[] {
  if (!sql) return [];

  const refs: TableRef[] = [];
  const seen = new Set<string>();

  // Strip comments and string literals
  const cleaned = sql
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, '');

  const addRef = (table: string, action: TableRef['action']) => {
    const key = `${table}:${action}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push({ table: table.toLowerCase().replace(/"/g, ''), action });
  };

  // CREATE TABLE [IF NOT EXISTS] <name>
  const createPattern = /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?(\w+)"?\.)?("?\w+"?)/gi;
  for (const m of cleaned.matchAll(createPattern)) {
    addRef(m[2], 'create');
  }

  // DROP TABLE [IF EXISTS] <name> [, <name>...]
  const dropPattern = /\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(.+?)(?:;|\bCASCADE\b|\bRESTRICT\b|$)/gi;
  for (const m of cleaned.matchAll(dropPattern)) {
    const tableList = m[1].split(',');
    for (const t of tableList) {
      const name = t.trim().replace(/"/g, '').split(/\s+/)[0];
      if (name && /^\w+$/.test(name)) addRef(name, 'drop');
    }
  }

  // ALTER TABLE <name>
  const alterPattern = /\bALTER\s+TABLE\s+(?:ONLY\s+)?(?:"?(\w+)"?\.)?("?\w+"?)/gi;
  for (const m of cleaned.matchAll(alterPattern)) {
    addRef(m[2], 'alter');
  }

  // INSERT INTO <name>
  const insertPattern = /\bINSERT\s+INTO\s+(?:"?(\w+)"?\.)?("?\w+"?)/gi;
  for (const m of cleaned.matchAll(insertPattern)) {
    addRef(m[2], 'write');
  }

  // UPDATE <name>
  const updatePattern = /\bUPDATE\s+(?:"?(\w+)"?\.)?("?\w+"?)\s+SET\b/gi;
  for (const m of cleaned.matchAll(updatePattern)) {
    addRef(m[2], 'write');
  }

  // DELETE FROM <name>
  const deletePattern = /\bDELETE\s+FROM\s+(?:"?(\w+)"?\.)?("?\w+"?)/gi;
  for (const m of cleaned.matchAll(deletePattern)) {
    addRef(m[2], 'write');
  }

  // REFERENCES <name> (FK references)
  const refPattern = /\bREFERENCES\s+(?:"?(\w+)"?\.)?("?\w+"?)/gi;
  for (const m of cleaned.matchAll(refPattern)) {
    addRef(m[2], 'read');
  }

  return refs;
}

/**
 * Determines the risk level of a migration based on its table references.
 */
function classifyRisk(refs: TableRef[]): MigrationNode['riskLevel'] {
  if (refs.some((r) => r.action === 'drop')) return 'destructive';
  if (refs.some((r) => r.action === 'alter' || r.action === 'write')) return 'caution';
  return 'safe';
}

/**
 * Builds a full dependency graph from a list of migrations.
 * Migrations are ordered by version. An edge is created when:
 * - A later migration alters/drops a table that an earlier one created
 * - A later migration references a table created by an earlier one
 */
export function buildDependencyGraph(migrations: Migration[]): DependencyGraph {
  const sorted = [...migrations].sort((a, b) => a.version - b.version);

  // Build nodes
  const nodes: MigrationNode[] = sorted.map((m) => {
    const tables = extractTableRefs(m.sqlContent);
    return {
      migrationId: m.id,
      version: m.version,
      description: m.description,
      tables,
      riskLevel: classifyRisk(tables),
    };
  });

  // Track which migration first creates each table
  const tableCreators = new Map<string, string>(); // table → migrationId
  const tableOwners = new Map<string, string[]>(); // table → migrationIds

  for (const node of nodes) {
    for (const ref of node.tables) {
      if (ref.action === 'create') {
        if (!tableCreators.has(ref.table)) {
          tableCreators.set(ref.table, node.migrationId);
        }
      }
      const owners = tableOwners.get(ref.table) || [];
      owners.push(node.migrationId);
      tableOwners.set(ref.table, owners);
    }
  }

  // Build edges: if migration B touches a table created/modified by earlier migration A
  const edges: MigrationEdge[] = [];
  const edgeSet = new Set<string>();

  for (const node of nodes) {
    for (const ref of node.tables) {
      const creator = tableCreators.get(ref.table);
      if (!creator || creator === node.migrationId) continue;

      const edgeKey = `${creator}->${node.migrationId}:${ref.table}`;
      if (edgeSet.has(edgeKey)) continue;
      edgeSet.add(edgeKey);

      let type: MigrationEdge['type'] = 'modifies-after';
      if (ref.action === 'drop') type = 'drops-created';
      else if (ref.action === 'read' || ref.action === 'create') type = 'creates-for';

      edges.push({
        from: creator,
        to: node.migrationId,
        table: ref.table,
        type,
      });
    }
  }

  return { nodes, edges, tableOwners };
}
