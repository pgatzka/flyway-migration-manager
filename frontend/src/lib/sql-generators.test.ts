import { describe, it, expect } from 'vitest';
import {
  generateCreateTable,
  generateDropTable,
  generateRenameTable,
  generateAddColumn,
  generateDropColumn,
  generateRenameColumn,
  generateAlterColumnType,
  generateAddForeignKey,
  generateDropConstraint,
  generateAddNotNull,
  generateDropNotNull,
  generateCreateIndex,
  generateDropIndex,
  generateCreateEnum,
  generateCreateView,
  generateDropView,
  generateMigrationFromDiff,
} from './sql-generators';
import type { SchemaDiff } from '@shared/types';

// ─── Create Table ────────────────────────────────────────

describe('generateCreateTable', () => {
  it('generates basic CREATE TABLE', () => {
    const sql = generateCreateTable({
      tableName: 'users',
      ifNotExists: false,
      columns: [
        { name: 'id', type: 'UUID', nullable: false, defaultValue: 'gen_random_uuid()', isPrimaryKey: true },
        { name: 'email', type: 'TEXT', nullable: false, defaultValue: '', isPrimaryKey: false },
      ],
    });
    expect(sql).toBe(
      'CREATE TABLE users (\n' +
      '  id UUID NOT NULL DEFAULT gen_random_uuid(),\n' +
      '  email TEXT NOT NULL,\n' +
      '  PRIMARY KEY (id)\n' +
      ');'
    );
  });

  it('generates with IF NOT EXISTS', () => {
    const sql = generateCreateTable({
      tableName: 'users',
      ifNotExists: true,
      columns: [
        { name: 'id', type: 'SERIAL', nullable: false, defaultValue: '', isPrimaryKey: true },
      ],
    });
    expect(sql).toContain('IF NOT EXISTS');
  });

  it('handles nullable columns with defaults', () => {
    const sql = generateCreateTable({
      tableName: 'posts',
      ifNotExists: false,
      columns: [
        { name: 'title', type: 'TEXT', nullable: true, defaultValue: '', isPrimaryKey: false },
        { name: 'views', type: 'INTEGER', nullable: true, defaultValue: '0', isPrimaryKey: false },
      ],
    });
    expect(sql).toContain('title TEXT');
    expect(sql).not.toContain('title TEXT NOT NULL');
    expect(sql).toContain('views INTEGER DEFAULT 0');
    expect(sql).not.toContain('PRIMARY KEY');
  });

  it('handles composite primary keys', () => {
    const sql = generateCreateTable({
      tableName: 'user_roles',
      ifNotExists: false,
      columns: [
        { name: 'user_id', type: 'UUID', nullable: false, defaultValue: '', isPrimaryKey: true },
        { name: 'role_id', type: 'UUID', nullable: false, defaultValue: '', isPrimaryKey: true },
      ],
    });
    expect(sql).toContain('PRIMARY KEY (user_id, role_id)');
  });

  it('returns empty string for missing table name', () => {
    expect(generateCreateTable({ tableName: '', ifNotExists: false, columns: [] })).toBe('');
  });

  it('returns empty string for no columns', () => {
    expect(generateCreateTable({ tableName: 'test', ifNotExists: false, columns: [] })).toBe('');
  });

  it('quotes identifiers with special characters', () => {
    const sql = generateCreateTable({
      tableName: 'My Table',
      ifNotExists: false,
      columns: [
        { name: 'First Name', type: 'TEXT', nullable: true, defaultValue: '', isPrimaryKey: false },
      ],
    });
    expect(sql).toContain('"My Table"');
    expect(sql).toContain('"First Name"');
  });
});

// ─── Drop Table ──────────────────────────────────────────

describe('generateDropTable', () => {
  it('generates basic DROP TABLE', () => {
    expect(generateDropTable({ tableName: 'users', ifExists: false, cascade: false }))
      .toBe('DROP TABLE users;');
  });

  it('generates with IF EXISTS', () => {
    expect(generateDropTable({ tableName: 'users', ifExists: true, cascade: false }))
      .toBe('DROP TABLE IF EXISTS users;');
  });

  it('generates with CASCADE', () => {
    expect(generateDropTable({ tableName: 'users', ifExists: false, cascade: true }))
      .toBe('DROP TABLE users CASCADE;');
  });

  it('generates with IF EXISTS and CASCADE', () => {
    expect(generateDropTable({ tableName: 'users', ifExists: true, cascade: true }))
      .toBe('DROP TABLE IF EXISTS users CASCADE;');
  });

  it('returns empty string for missing table name', () => {
    expect(generateDropTable({ tableName: '', ifExists: false, cascade: false })).toBe('');
  });
});

// ─── Rename Table ────────────────────────────────────────

describe('generateRenameTable', () => {
  it('generates ALTER TABLE RENAME', () => {
    expect(generateRenameTable({ oldName: 'users', newName: 'accounts' }))
      .toBe('ALTER TABLE users RENAME TO accounts;');
  });

  it('returns empty for missing old name', () => {
    expect(generateRenameTable({ oldName: '', newName: 'accounts' })).toBe('');
  });

  it('returns empty for missing new name', () => {
    expect(generateRenameTable({ oldName: 'users', newName: '' })).toBe('');
  });
});

// ─── Add Column ──────────────────────────────────────────

describe('generateAddColumn', () => {
  it('generates ADD COLUMN', () => {
    expect(generateAddColumn({
      tableName: 'users',
      columnName: 'age',
      type: 'INTEGER',
      nullable: true,
      defaultValue: '',
    })).toBe('ALTER TABLE users ADD COLUMN age INTEGER;');
  });

  it('generates NOT NULL with default', () => {
    expect(generateAddColumn({
      tableName: 'users',
      columnName: 'status',
      type: 'TEXT',
      nullable: false,
      defaultValue: "'active'",
    })).toBe("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';");
  });

  it('returns empty for missing fields', () => {
    expect(generateAddColumn({ tableName: '', columnName: 'a', type: 'TEXT', nullable: true, defaultValue: '' })).toBe('');
    expect(generateAddColumn({ tableName: 'a', columnName: '', type: 'TEXT', nullable: true, defaultValue: '' })).toBe('');
    expect(generateAddColumn({ tableName: 'a', columnName: 'a', type: '', nullable: true, defaultValue: '' })).toBe('');
  });
});

// ─── Drop Column ─────────────────────────────────────────

describe('generateDropColumn', () => {
  it('generates DROP COLUMN', () => {
    expect(generateDropColumn({ tableName: 'users', columnName: 'age', ifExists: false }))
      .toBe('ALTER TABLE users DROP COLUMN age;');
  });

  it('generates with IF EXISTS', () => {
    expect(generateDropColumn({ tableName: 'users', columnName: 'age', ifExists: true }))
      .toBe('ALTER TABLE users DROP COLUMN IF EXISTS age;');
  });

  it('returns empty for missing fields', () => {
    expect(generateDropColumn({ tableName: '', columnName: 'a', ifExists: false })).toBe('');
    expect(generateDropColumn({ tableName: 'a', columnName: '', ifExists: false })).toBe('');
  });
});

// ─── Rename Column ───────────────────────────────────────

describe('generateRenameColumn', () => {
  it('generates RENAME COLUMN', () => {
    expect(generateRenameColumn({ tableName: 'users', oldName: 'name', newName: 'full_name' }))
      .toBe('ALTER TABLE users RENAME COLUMN name TO full_name;');
  });

  it('returns empty for missing fields', () => {
    expect(generateRenameColumn({ tableName: '', oldName: 'a', newName: 'b' })).toBe('');
    expect(generateRenameColumn({ tableName: 'a', oldName: '', newName: 'b' })).toBe('');
    expect(generateRenameColumn({ tableName: 'a', oldName: 'a', newName: '' })).toBe('');
  });
});

// ─── Alter Column Type ──────────────────────────────────

describe('generateAlterColumnType', () => {
  it('generates ALTER COLUMN TYPE', () => {
    expect(generateAlterColumnType({
      tableName: 'users',
      columnName: 'age',
      newType: 'BIGINT',
      usingExpression: '',
    })).toBe('ALTER TABLE users ALTER COLUMN age TYPE BIGINT;');
  });

  it('generates with USING expression', () => {
    expect(generateAlterColumnType({
      tableName: 'users',
      columnName: 'age',
      newType: 'TEXT',
      usingExpression: 'age::TEXT',
    })).toBe('ALTER TABLE users ALTER COLUMN age TYPE TEXT USING age::TEXT;');
  });

  it('returns empty for missing fields', () => {
    expect(generateAlterColumnType({ tableName: '', columnName: 'a', newType: 'TEXT', usingExpression: '' })).toBe('');
    expect(generateAlterColumnType({ tableName: 'a', columnName: '', newType: 'TEXT', usingExpression: '' })).toBe('');
    expect(generateAlterColumnType({ tableName: 'a', columnName: 'a', newType: '', usingExpression: '' })).toBe('');
  });
});

// ─── Add Foreign Key ─────────────────────────────────────

describe('generateAddForeignKey', () => {
  it('generates ADD FOREIGN KEY with default actions', () => {
    const sql = generateAddForeignKey({
      tableName: 'posts',
      columnName: 'user_id',
      referencedTable: 'users',
      referencedColumn: 'id',
      constraintName: '',
      onDelete: 'NO ACTION',
      onUpdate: 'NO ACTION',
    });
    expect(sql).toBe('ALTER TABLE posts ADD CONSTRAINT fk_posts_user_id FOREIGN KEY (user_id) REFERENCES users (id);');
  });

  it('generates with custom constraint name and ON DELETE CASCADE', () => {
    const sql = generateAddForeignKey({
      tableName: 'posts',
      columnName: 'user_id',
      referencedTable: 'users',
      referencedColumn: 'id',
      constraintName: 'fk_custom',
      onDelete: 'CASCADE',
      onUpdate: 'NO ACTION',
    });
    expect(sql).toBe('ALTER TABLE posts ADD CONSTRAINT fk_custom FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;');
  });

  it('generates with ON DELETE SET NULL and ON UPDATE CASCADE', () => {
    const sql = generateAddForeignKey({
      tableName: 'posts',
      columnName: 'user_id',
      referencedTable: 'users',
      referencedColumn: 'id',
      constraintName: '',
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
    expect(sql).toContain('ON DELETE SET NULL');
    expect(sql).toContain('ON UPDATE CASCADE');
  });

  it('returns empty for missing fields', () => {
    expect(generateAddForeignKey({
      tableName: '',
      columnName: 'a',
      referencedTable: 'b',
      referencedColumn: 'c',
      constraintName: '',
      onDelete: 'NO ACTION',
      onUpdate: 'NO ACTION',
    })).toBe('');
  });
});

// ─── Drop Constraint ─────────────────────────────────────

describe('generateDropConstraint', () => {
  it('generates DROP CONSTRAINT', () => {
    expect(generateDropConstraint({ tableName: 'posts', constraintName: 'fk_posts_user_id' }))
      .toBe('ALTER TABLE posts DROP CONSTRAINT fk_posts_user_id;');
  });

  it('returns empty for missing fields', () => {
    expect(generateDropConstraint({ tableName: '', constraintName: 'a' })).toBe('');
    expect(generateDropConstraint({ tableName: 'a', constraintName: '' })).toBe('');
  });
});

// ─── Add NOT NULL ────────────────────────────────────────

describe('generateAddNotNull', () => {
  it('generates SET NOT NULL without default', () => {
    expect(generateAddNotNull({ tableName: 'users', columnName: 'email', defaultValue: '' }))
      .toBe('ALTER TABLE users ALTER COLUMN email SET NOT NULL;');
  });

  it('generates UPDATE + SET NOT NULL with default', () => {
    const sql = generateAddNotNull({ tableName: 'users', columnName: 'email', defaultValue: "''" });
    expect(sql).toContain("UPDATE users SET email = '' WHERE email IS NULL;");
    expect(sql).toContain('ALTER TABLE users ALTER COLUMN email SET NOT NULL;');
  });

  it('returns empty for missing fields', () => {
    expect(generateAddNotNull({ tableName: '', columnName: 'a', defaultValue: '' })).toBe('');
    expect(generateAddNotNull({ tableName: 'a', columnName: '', defaultValue: '' })).toBe('');
  });
});

// ─── Drop NOT NULL ───────────────────────────────────────

describe('generateDropNotNull', () => {
  it('generates DROP NOT NULL', () => {
    expect(generateDropNotNull({ tableName: 'users', columnName: 'email' }))
      .toBe('ALTER TABLE users ALTER COLUMN email DROP NOT NULL;');
  });

  it('returns empty for missing fields', () => {
    expect(generateDropNotNull({ tableName: '', columnName: 'a' })).toBe('');
    expect(generateDropNotNull({ tableName: 'a', columnName: '' })).toBe('');
  });
});

// ─── Create Index ────────────────────────────────────────

describe('generateCreateIndex', () => {
  it('generates basic CREATE INDEX', () => {
    expect(generateCreateIndex({
      tableName: 'users',
      columns: ['email'],
      indexName: '',
      unique: false,
      concurrently: false,
      where: '',
    })).toBe('CREATE INDEX idx_users_email ON users (email);');
  });

  it('generates UNIQUE INDEX', () => {
    expect(generateCreateIndex({
      tableName: 'users',
      columns: ['email'],
      indexName: 'unique_email',
      unique: true,
      concurrently: false,
      where: '',
    })).toBe('CREATE UNIQUE INDEX unique_email ON users (email);');
  });

  it('generates CONCURRENTLY', () => {
    const sql = generateCreateIndex({
      tableName: 'users',
      columns: ['email'],
      indexName: '',
      unique: false,
      concurrently: true,
      where: '',
    });
    expect(sql).toContain('CONCURRENTLY');
  });

  it('generates multi-column index', () => {
    const sql = generateCreateIndex({
      tableName: 'posts',
      columns: ['user_id', 'created_at'],
      indexName: '',
      unique: false,
      concurrently: false,
      where: '',
    });
    expect(sql).toContain('(user_id, created_at)');
    expect(sql).toContain('idx_posts_user_id_created_at');
  });

  it('generates partial index with WHERE', () => {
    const sql = generateCreateIndex({
      tableName: 'users',
      columns: ['email'],
      indexName: '',
      unique: true,
      concurrently: false,
      where: 'active = true',
    });
    expect(sql).toContain('WHERE active = true');
  });

  it('returns empty for missing fields', () => {
    expect(generateCreateIndex({
      tableName: '',
      columns: ['a'],
      indexName: '',
      unique: false,
      concurrently: false,
      where: '',
    })).toBe('');
    expect(generateCreateIndex({
      tableName: 'a',
      columns: [],
      indexName: '',
      unique: false,
      concurrently: false,
      where: '',
    })).toBe('');
  });
});

// ─── Drop Index ──────────────────────────────────────────

describe('generateDropIndex', () => {
  it('generates basic DROP INDEX', () => {
    expect(generateDropIndex({ indexName: 'idx_users_email', ifExists: false, concurrently: false }))
      .toBe('DROP INDEX idx_users_email;');
  });

  it('generates with IF EXISTS', () => {
    expect(generateDropIndex({ indexName: 'idx_users_email', ifExists: true, concurrently: false }))
      .toBe('DROP INDEX IF EXISTS idx_users_email;');
  });

  it('generates with CONCURRENTLY', () => {
    expect(generateDropIndex({ indexName: 'idx_users_email', ifExists: false, concurrently: true }))
      .toBe('DROP INDEX CONCURRENTLY idx_users_email;');
  });

  it('generates with IF EXISTS and CONCURRENTLY', () => {
    expect(generateDropIndex({ indexName: 'idx_users_email', ifExists: true, concurrently: true }))
      .toBe('DROP INDEX CONCURRENTLY IF EXISTS idx_users_email;');
  });

  it('returns empty for missing index name', () => {
    expect(generateDropIndex({ indexName: '', ifExists: false, concurrently: false })).toBe('');
  });
});

// ─── Create Enum ─────────────────────────────────────────

describe('generateCreateEnum', () => {
  it('generates CREATE TYPE AS ENUM', () => {
    expect(generateCreateEnum({ typeName: 'status', values: ['active', 'inactive', 'banned'] }))
      .toBe("CREATE TYPE status AS ENUM ('active', 'inactive', 'banned');");
  });

  it('escapes single quotes in values', () => {
    expect(generateCreateEnum({ typeName: 'greeting', values: ["it's", "they're"] }))
      .toBe("CREATE TYPE greeting AS ENUM ('it''s', 'they''re');");
  });

  it('returns empty for missing type name', () => {
    expect(generateCreateEnum({ typeName: '', values: ['a'] })).toBe('');
  });

  it('returns empty for no values', () => {
    expect(generateCreateEnum({ typeName: 'test', values: [] })).toBe('');
  });
});

// ─── Create View ─────────────────────────────────────────

describe('generateCreateView', () => {
  it('generates CREATE VIEW', () => {
    expect(generateCreateView({
      viewName: 'active_users',
      orReplace: false,
      query: 'SELECT * FROM users WHERE active = true',
    })).toBe('CREATE VIEW active_users AS\nSELECT * FROM users WHERE active = true;');
  });

  it('generates CREATE OR REPLACE VIEW', () => {
    const sql = generateCreateView({
      viewName: 'active_users',
      orReplace: true,
      query: 'SELECT * FROM users WHERE active = true',
    });
    expect(sql).toContain('CREATE OR REPLACE VIEW');
  });

  it('returns empty for missing fields', () => {
    expect(generateCreateView({ viewName: '', orReplace: false, query: 'SELECT 1' })).toBe('');
    expect(generateCreateView({ viewName: 'test', orReplace: false, query: '' })).toBe('');
  });
});

// ─── Drop View ───────────────────────────────────────────

describe('generateDropView', () => {
  it('generates basic DROP VIEW', () => {
    expect(generateDropView({ viewName: 'active_users', ifExists: false, cascade: false }))
      .toBe('DROP VIEW active_users;');
  });

  it('generates with IF EXISTS', () => {
    expect(generateDropView({ viewName: 'active_users', ifExists: true, cascade: false }))
      .toBe('DROP VIEW IF EXISTS active_users;');
  });

  it('generates with CASCADE', () => {
    expect(generateDropView({ viewName: 'active_users', ifExists: false, cascade: true }))
      .toBe('DROP VIEW active_users CASCADE;');
  });

  it('returns empty for missing view name', () => {
    expect(generateDropView({ viewName: '', ifExists: false, cascade: false })).toBe('');
  });
});

// ─── Generate Migration from Diff ──────────────────────

describe('generateMigrationFromDiff', () => {
  it('generates SQL for added tables', () => {
    const diff: SchemaDiff = {
      addedTables: [{
        name: 'posts',
        columns: [
          { name: 'id', dataType: 'uuid', isNullable: false, columnDefault: 'gen_random_uuid()', isPrimaryKey: true },
          { name: 'title', dataType: 'text', isNullable: false, columnDefault: null, isPrimaryKey: false },
        ],
        foreignKeys: [],
      }],
      removedTables: [],
      modifiedTables: [],
    };
    const sql = generateMigrationFromDiff(diff);
    expect(sql).toContain('CREATE TABLE posts');
    expect(sql).toContain('id UUID');
    expect(sql).toContain('title TEXT');
  });

  it('generates SQL for removed tables', () => {
    const diff: SchemaDiff = {
      addedTables: [],
      removedTables: [{ name: 'old_table', columns: [], foreignKeys: [] }],
      modifiedTables: [],
    };
    const sql = generateMigrationFromDiff(diff);
    expect(sql).toContain('DROP TABLE IF EXISTS old_table CASCADE;');
  });

  it('generates SQL for added columns', () => {
    const diff: SchemaDiff = {
      addedTables: [],
      removedTables: [],
      modifiedTables: [{
        tableName: 'users',
        addedColumns: [{ name: 'bio', dataType: 'text', isNullable: true, columnDefault: null, isPrimaryKey: false }],
        removedColumns: [],
        modifiedColumns: [],
        addedForeignKeys: [],
        removedForeignKeys: [],
      }],
    };
    const sql = generateMigrationFromDiff(diff);
    expect(sql).toContain('ALTER TABLE users ADD COLUMN bio TEXT;');
  });

  it('generates SQL for removed columns', () => {
    const diff: SchemaDiff = {
      addedTables: [],
      removedTables: [],
      modifiedTables: [{
        tableName: 'users',
        addedColumns: [],
        removedColumns: [{ name: 'legacy', dataType: 'text', isNullable: true, columnDefault: null, isPrimaryKey: false }],
        modifiedColumns: [],
        addedForeignKeys: [],
        removedForeignKeys: [],
      }],
    };
    const sql = generateMigrationFromDiff(diff);
    expect(sql).toContain('ALTER TABLE users DROP COLUMN legacy;');
  });

  it('generates SQL for type changes', () => {
    const diff: SchemaDiff = {
      addedTables: [],
      removedTables: [],
      modifiedTables: [{
        tableName: 'products',
        addedColumns: [],
        removedColumns: [],
        modifiedColumns: [{
          columnName: 'price',
          before: { name: 'price', dataType: 'integer', isNullable: false, columnDefault: null, isPrimaryKey: false },
          after: { name: 'price', dataType: 'numeric', isNullable: false, columnDefault: null, isPrimaryKey: false },
        }],
        addedForeignKeys: [],
        removedForeignKeys: [],
      }],
    };
    const sql = generateMigrationFromDiff(diff);
    expect(sql).toContain('ALTER TABLE products ALTER COLUMN price TYPE NUMERIC;');
  });

  it('generates SQL for nullability changes', () => {
    const diff: SchemaDiff = {
      addedTables: [],
      removedTables: [],
      modifiedTables: [{
        tableName: 'users',
        addedColumns: [],
        removedColumns: [],
        modifiedColumns: [{
          columnName: 'email',
          before: { name: 'email', dataType: 'text', isNullable: true, columnDefault: null, isPrimaryKey: false },
          after: { name: 'email', dataType: 'text', isNullable: false, columnDefault: null, isPrimaryKey: false },
        }],
        addedForeignKeys: [],
        removedForeignKeys: [],
      }],
    };
    const sql = generateMigrationFromDiff(diff);
    expect(sql).toContain('ALTER TABLE users ALTER COLUMN email SET NOT NULL;');
  });

  it('generates SQL for FK changes', () => {
    const diff: SchemaDiff = {
      addedTables: [],
      removedTables: [],
      modifiedTables: [{
        tableName: 'orders',
        addedColumns: [],
        removedColumns: [],
        modifiedColumns: [],
        addedForeignKeys: [{ constraintName: 'fk_orders_user', columnName: 'user_id', referencedTable: 'users', referencedColumn: 'id' }],
        removedForeignKeys: [{ constraintName: 'fk_orders_old', columnName: 'old_id', referencedTable: 'old', referencedColumn: 'id' }],
      }],
    };
    const sql = generateMigrationFromDiff(diff);
    expect(sql).toContain('DROP CONSTRAINT fk_orders_old');
    expect(sql).toContain('ADD CONSTRAINT fk_orders_user');
    // FK drops should come before FK adds
    expect(sql.indexOf('DROP CONSTRAINT')).toBeLessThan(sql.indexOf('ADD CONSTRAINT'));
  });

  it('returns empty string for no changes', () => {
    const diff: SchemaDiff = { addedTables: [], removedTables: [], modifiedTables: [] };
    expect(generateMigrationFromDiff(diff)).toBe('');
  });
});
