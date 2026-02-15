import { describe, it, expect } from 'vitest';
import { generateRollbackSql } from './rollback-generator';

describe('generateRollbackSql', () => {
  it('returns empty for empty input', () => {
    expect(generateRollbackSql('')).toBe('');
    expect(generateRollbackSql('   ')).toBe('');
  });

  it('generates DROP TABLE for CREATE TABLE', () => {
    const up = 'CREATE TABLE users (id serial PRIMARY KEY, name text);';
    const down = generateRollbackSql(up);
    expect(down).toContain('DROP TABLE IF EXISTS users CASCADE;');
  });

  it('generates DROP TABLE for CREATE TABLE IF NOT EXISTS', () => {
    const up = 'CREATE TABLE IF NOT EXISTS orders (id int);';
    const down = generateRollbackSql(up);
    expect(down).toContain('DROP TABLE IF EXISTS orders CASCADE;');
  });

  it('generates DROP COLUMN for ADD COLUMN', () => {
    const up = 'ALTER TABLE users ADD COLUMN email TEXT NOT NULL;';
    const down = generateRollbackSql(up);
    expect(down).toContain('ALTER TABLE users DROP COLUMN IF EXISTS email;');
  });

  it('generates RENAME COLUMN reversal', () => {
    const up = 'ALTER TABLE users RENAME COLUMN old_name TO new_name;';
    const down = generateRollbackSql(up);
    expect(down).toContain('ALTER TABLE users RENAME COLUMN new_name TO old_name;');
  });

  it('generates RENAME TABLE reversal', () => {
    const up = 'ALTER TABLE old_table RENAME TO new_table;';
    const down = generateRollbackSql(up);
    expect(down).toContain('ALTER TABLE new_table RENAME TO old_table;');
  });

  it('generates DROP NOT NULL for SET NOT NULL', () => {
    const up = 'ALTER TABLE users ALTER COLUMN email SET NOT NULL;';
    const down = generateRollbackSql(up);
    expect(down).toContain('ALTER TABLE users ALTER COLUMN email DROP NOT NULL;');
  });

  it('generates SET NOT NULL for DROP NOT NULL', () => {
    const up = 'ALTER TABLE users ALTER COLUMN email DROP NOT NULL;';
    const down = generateRollbackSql(up);
    expect(down).toContain('ALTER TABLE users ALTER COLUMN email SET NOT NULL;');
  });

  it('generates DROP DEFAULT for SET DEFAULT', () => {
    const up = "ALTER TABLE users ALTER COLUMN status SET DEFAULT 'active';";
    const down = generateRollbackSql(up);
    expect(down).toContain('ALTER TABLE users ALTER COLUMN status DROP DEFAULT;');
  });

  it('generates DROP CONSTRAINT for ADD CONSTRAINT', () => {
    const up = 'ALTER TABLE orders ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users (id);';
    const down = generateRollbackSql(up);
    expect(down).toContain('ALTER TABLE orders DROP CONSTRAINT IF EXISTS fk_user;');
  });

  it('generates DROP INDEX for CREATE INDEX', () => {
    const up = 'CREATE UNIQUE INDEX idx_users_email ON users (email);';
    const down = generateRollbackSql(up);
    expect(down).toContain('DROP INDEX IF EXISTS idx_users_email;');
  });

  it('generates DROP TYPE for CREATE TYPE ENUM', () => {
    const up = "CREATE TYPE status AS ENUM ('active', 'inactive');";
    const down = generateRollbackSql(up);
    expect(down).toContain('DROP TYPE IF EXISTS status;');
  });

  it('generates DROP VIEW for CREATE VIEW', () => {
    const up = 'CREATE VIEW active_users AS SELECT * FROM users WHERE active = true;';
    const down = generateRollbackSql(up);
    expect(down).toContain('DROP VIEW IF EXISTS active_users;');
  });

  it('generates DROP VIEW for CREATE OR REPLACE VIEW', () => {
    const up = 'CREATE OR REPLACE VIEW active_users AS SELECT * FROM users;';
    const down = generateRollbackSql(up);
    expect(down).toContain('DROP VIEW IF EXISTS active_users;');
  });

  it('generates TODO comments for irreversible operations', () => {
    const up = 'DROP TABLE users;';
    const down = generateRollbackSql(up);
    expect(down).toContain('-- TODO: Recreate table users');
  });

  it('reverses statement order', () => {
    const up = `
      CREATE TABLE users (id serial PRIMARY KEY);
      ALTER TABLE users ADD COLUMN email text;
    `;
    const down = generateRollbackSql(up);
    const dropColIdx = down.indexOf('DROP COLUMN');
    const dropTableIdx = down.indexOf('DROP TABLE');
    expect(dropColIdx).toBeLessThan(dropTableIdx);
  });

  it('handles multi-statement complex migration', () => {
    const up = `
      CREATE TABLE categories (id serial PRIMARY KEY, name text NOT NULL);
      CREATE TABLE products (id serial PRIMARY KEY, name text, category_id int);
      ALTER TABLE products ADD CONSTRAINT fk_category FOREIGN KEY (category_id) REFERENCES categories (id);
      CREATE INDEX idx_products_category ON products (category_id);
    `;
    const down = generateRollbackSql(up);
    expect(down).toContain('DROP INDEX IF EXISTS idx_products_category;');
    expect(down).toContain('DROP CONSTRAINT IF EXISTS fk_category;');
    expect(down).toContain('DROP TABLE IF EXISTS products CASCADE;');
    expect(down).toContain('DROP TABLE IF EXISTS categories CASCADE;');
  });

  it('includes header comment', () => {
    const up = 'CREATE TABLE t (id int);';
    const down = generateRollbackSql(up);
    expect(down).toContain('-- Auto-generated rollback SQL');
    expect(down).toContain('-- Review carefully before executing');
  });

  it('generates TODO for ALTER COLUMN TYPE', () => {
    const up = 'ALTER TABLE users ALTER COLUMN age TYPE bigint;';
    const down = generateRollbackSql(up);
    expect(down).toContain('-- TODO:');
    expect(down).toContain('age');
  });
});
