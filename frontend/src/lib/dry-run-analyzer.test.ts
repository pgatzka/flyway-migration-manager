import { describe, it, expect } from 'vitest';
import { analyzeDryRun } from './dry-run-analyzer';

describe('analyzeDryRun', () => {
  it('returns empty report for empty SQL', () => {
    const report = analyzeDryRun('');
    expect(report.operations).toEqual([]);
    expect(report.estimatedRisk).toBe('low');
    expect(report.isFullyReversible).toBe(true);
  });

  it('detects CREATE TABLE', () => {
    const report = analyzeDryRun('CREATE TABLE users (id int);');
    expect(report.tablesCreated).toEqual(['users']);
    expect(report.operations[0].type).toBe('CREATE TABLE');
    expect(report.operations[0].reversible).toBe(true);
  });

  it('detects DROP TABLE as critical risk', () => {
    const report = analyzeDryRun('DROP TABLE users;');
    expect(report.tablesDropped).toEqual(['users']);
    expect(report.estimatedRisk).toBe('critical');
    expect(report.operations[0].reversible).toBe(false);
  });

  it('detects ALTER TABLE ADD COLUMN', () => {
    const report = analyzeDryRun('ALTER TABLE users ADD COLUMN email text;');
    expect(report.tablesModified).toEqual(['users']);
    expect(report.operations[0].detail).toContain('email');
  });

  it('detects ALTER TABLE DROP COLUMN as irreversible', () => {
    const report = analyzeDryRun('ALTER TABLE users DROP COLUMN email;');
    expect(report.operations[0].reversible).toBe(false);
  });

  it('detects CREATE INDEX', () => {
    const report = analyzeDryRun('CREATE INDEX idx_email ON users (email);');
    expect(report.indexesCreated).toEqual(['idx_email']);
    expect(report.operations[0].reversible).toBe(true);
  });

  it('detects INSERT as data modification', () => {
    const report = analyzeDryRun("INSERT INTO users (name) VALUES ('test');");
    expect(report.dataModifications).toBe(1);
  });

  it('detects UPDATE without WHERE as high risk', () => {
    const report = analyzeDryRun("UPDATE users SET active = true;");
    expect(report.estimatedRisk).toBe('high');
    expect(report.operations[0].detail).toContain('ALL rows');
  });

  it('detects UPDATE with WHERE', () => {
    const report = analyzeDryRun("UPDATE users SET active = true WHERE id = 1;");
    expect(report.operations[0].detail).not.toContain('ALL rows');
  });

  it('detects DELETE as high risk', () => {
    const report = analyzeDryRun('DELETE FROM users WHERE id = 1;');
    expect(report.estimatedRisk).toBe('high');
  });

  it('reports fully reversible for safe operations', () => {
    const report = analyzeDryRun(`
      CREATE TABLE users (id int);
      CREATE INDEX idx_id ON users (id);
    `);
    expect(report.isFullyReversible).toBe(true);
    expect(report.estimatedRisk).toBe('low');
  });

  it('reports not fully reversible when mixing operations', () => {
    const report = analyzeDryRun(`
      CREATE TABLE users (id int);
      DROP TABLE old_users;
    `);
    expect(report.isFullyReversible).toBe(false);
  });

  it('handles complex multi-statement SQL', () => {
    const report = analyzeDryRun(`
      CREATE TABLE categories (id serial PRIMARY KEY, name text);
      CREATE TABLE products (id serial, name text, category_id int);
      ALTER TABLE products ADD CONSTRAINT fk_cat FOREIGN KEY (category_id) REFERENCES categories (id);
      CREATE INDEX idx_products_cat ON products (category_id);
      INSERT INTO categories (name) VALUES ('Default');
    `);
    expect(report.tablesCreated).toContain('categories');
    expect(report.tablesCreated).toContain('products');
    expect(report.indexesCreated).toContain('idx_products_cat');
    expect(report.dataModifications).toBe(1);
    expect(report.operations.length).toBe(5);
  });

  it('provides line numbers for operations', () => {
    const report = analyzeDryRun('CREATE TABLE a (id int);\nDROP TABLE b;');
    expect(report.operations[0].line).toBe(1);
    expect(report.operations[1].line).toBe(2);
  });
});
