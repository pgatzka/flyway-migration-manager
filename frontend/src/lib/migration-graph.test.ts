import { describe, it, expect } from 'vitest';
import { extractTableRefs, buildDependencyGraph } from './migration-graph';
import type { Migration } from '@shared/types';

function makeMigration(overrides: Partial<Migration> & { id: string; version: number; sqlContent: string }): Migration {
  return {
    projectId: 'proj-1',
    description: `V${overrides.version}`,
    downSqlContent: '',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    ...overrides,
  };
}

describe('extractTableRefs', () => {
  it('extracts CREATE TABLE', () => {
    const refs = extractTableRefs('CREATE TABLE users (id serial PRIMARY KEY);');
    expect(refs).toEqual([{ table: 'users', action: 'create' }]);
  });

  it('extracts CREATE TABLE IF NOT EXISTS', () => {
    const refs = extractTableRefs('CREATE TABLE IF NOT EXISTS orders (id int);');
    expect(refs).toEqual([{ table: 'orders', action: 'create' }]);
  });

  it('extracts DROP TABLE', () => {
    const refs = extractTableRefs('DROP TABLE IF EXISTS old_table;');
    expect(refs).toEqual([{ table: 'old_table', action: 'drop' }]);
  });

  it('extracts ALTER TABLE', () => {
    const refs = extractTableRefs('ALTER TABLE users ADD COLUMN email TEXT;');
    expect(refs).toEqual([{ table: 'users', action: 'alter' }]);
  });

  it('extracts INSERT INTO', () => {
    const refs = extractTableRefs("INSERT INTO users (name) VALUES ('test');");
    expect(refs).toEqual([{ table: 'users', action: 'write' }]);
  });

  it('extracts UPDATE', () => {
    const refs = extractTableRefs("UPDATE users SET name = 'test' WHERE id = 1;");
    expect(refs).toEqual([{ table: 'users', action: 'write' }]);
  });

  it('extracts DELETE FROM', () => {
    const refs = extractTableRefs('DELETE FROM users WHERE id = 1;');
    expect(refs).toEqual([{ table: 'users', action: 'write' }]);
  });

  it('extracts REFERENCES (FK)', () => {
    const refs = extractTableRefs(
      'ALTER TABLE orders ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users (id);'
    );
    expect(refs).toContainEqual({ table: 'orders', action: 'alter' });
    expect(refs).toContainEqual({ table: 'users', action: 'read' });
  });

  it('extracts multiple tables from complex SQL', () => {
    const sql = `
      CREATE TABLE categories (id serial PRIMARY KEY, name text);
      CREATE TABLE products (id serial, category_id int REFERENCES categories(id));
      ALTER TABLE products ADD COLUMN price numeric;
    `;
    const refs = extractTableRefs(sql);
    expect(refs).toContainEqual({ table: 'categories', action: 'create' });
    expect(refs).toContainEqual({ table: 'products', action: 'create' });
    expect(refs).toContainEqual({ table: 'products', action: 'alter' });
    expect(refs).toContainEqual({ table: 'categories', action: 'read' });
  });

  it('returns empty for empty SQL', () => {
    expect(extractTableRefs('')).toEqual([]);
  });

  it('deduplicates same table+action', () => {
    const sql = `
      ALTER TABLE users ADD COLUMN a text;
      ALTER TABLE users ADD COLUMN b text;
    `;
    const refs = extractTableRefs(sql);
    const alters = refs.filter((r) => r.table === 'users' && r.action === 'alter');
    expect(alters).toHaveLength(1);
  });

  it('ignores tables in comments', () => {
    const sql = `
      -- DROP TABLE secret_table;
      CREATE TABLE real_table (id int);
    `;
    const refs = extractTableRefs(sql);
    expect(refs).toEqual([{ table: 'real_table', action: 'create' }]);
  });
});

describe('buildDependencyGraph', () => {
  it('creates nodes for each migration', () => {
    const migrations = [
      makeMigration({ id: 'm1', version: 1, sqlContent: 'CREATE TABLE users (id int);' }),
      makeMigration({ id: 'm2', version: 2, sqlContent: 'ALTER TABLE users ADD COLUMN name text;' }),
    ];
    const graph = buildDependencyGraph(migrations);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes[0].version).toBe(1);
    expect(graph.nodes[1].version).toBe(2);
  });

  it('creates edge when migration alters a table created by earlier migration', () => {
    const migrations = [
      makeMigration({ id: 'm1', version: 1, sqlContent: 'CREATE TABLE users (id int);' }),
      makeMigration({ id: 'm2', version: 2, sqlContent: 'ALTER TABLE users ADD COLUMN email text;' }),
    ];
    const graph = buildDependencyGraph(migrations);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({
      from: 'm1',
      to: 'm2',
      table: 'users',
      type: 'modifies-after',
    });
  });

  it('creates drops-created edge', () => {
    const migrations = [
      makeMigration({ id: 'm1', version: 1, sqlContent: 'CREATE TABLE temp (id int);' }),
      makeMigration({ id: 'm2', version: 2, sqlContent: 'DROP TABLE temp;' }),
    ];
    const graph = buildDependencyGraph(migrations);
    expect(graph.edges[0].type).toBe('drops-created');
  });

  it('classifies risk levels correctly', () => {
    const migrations = [
      makeMigration({ id: 'm1', version: 1, sqlContent: 'CREATE TABLE a (id int);' }),
      makeMigration({ id: 'm2', version: 2, sqlContent: 'ALTER TABLE a ADD COLUMN x text;' }),
      makeMigration({ id: 'm3', version: 3, sqlContent: 'DROP TABLE a;' }),
    ];
    const graph = buildDependencyGraph(migrations);
    expect(graph.nodes[0].riskLevel).toBe('safe');
    expect(graph.nodes[1].riskLevel).toBe('caution');
    expect(graph.nodes[2].riskLevel).toBe('destructive');
  });

  it('builds tableOwners map', () => {
    const migrations = [
      makeMigration({ id: 'm1', version: 1, sqlContent: 'CREATE TABLE users (id int);' }),
      makeMigration({ id: 'm2', version: 2, sqlContent: 'ALTER TABLE users ADD COLUMN name text;' }),
    ];
    const graph = buildDependencyGraph(migrations);
    expect(graph.tableOwners.get('users')).toEqual(['m1', 'm2']);
  });

  it('handles migrations with no table references', () => {
    const migrations = [
      makeMigration({ id: 'm1', version: 1, sqlContent: '-- just a comment' }),
    ];
    const graph = buildDependencyGraph(migrations);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].tables).toEqual([]);
    expect(graph.edges).toEqual([]);
  });

  it('handles unordered migrations (sorts by version)', () => {
    const migrations = [
      makeMigration({ id: 'm2', version: 2, sqlContent: 'ALTER TABLE users ADD COLUMN x text;' }),
      makeMigration({ id: 'm1', version: 1, sqlContent: 'CREATE TABLE users (id int);' }),
    ];
    const graph = buildDependencyGraph(migrations);
    expect(graph.nodes[0].version).toBe(1);
    expect(graph.nodes[1].version).toBe(2);
    expect(graph.edges[0].from).toBe('m1');
  });
});
