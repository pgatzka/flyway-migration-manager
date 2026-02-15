/**
 * Pure SQL generator functions — one per operation.
 * Each takes a config object and returns a SQL string.
 * No React dependencies — fully testable.
 */

import type { SchemaDiff, SchemaColumn } from '@shared/types';

// ─── Helpers ──────────────────────────────────────────────

function ident(name: string): string {
  // Quote identifiers that need it (reserved words, mixed case, special chars)
  if (/^[a-z_][a-z0-9_]*$/.test(name)) return name;
  return `"${name.replace(/"/g, '""')}"`;
}

function literal(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

// ─── Column definition for CREATE TABLE ──────────────────

export interface ColumnDef {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string;
  isPrimaryKey: boolean;
}

function columnDefToSql(col: ColumnDef): string {
  const parts = [ident(col.name), col.type];
  if (!col.nullable) parts.push('NOT NULL');
  if (col.defaultValue) parts.push(`DEFAULT ${col.defaultValue}`);
  return parts.join(' ');
}

// ─── 1. Create Table ─────────────────────────────────────

export interface CreateTableConfig {
  tableName: string;
  ifNotExists: boolean;
  columns: ColumnDef[];
}

export function generateCreateTable(cfg: CreateTableConfig): string {
  if (!cfg.tableName || cfg.columns.length === 0) return '';
  const pkCols = cfg.columns.filter((c) => c.isPrimaryKey);
  const lines = cfg.columns.map((c) => '  ' + columnDefToSql(c));
  if (pkCols.length > 0) {
    lines.push(`  PRIMARY KEY (${pkCols.map((c) => ident(c.name)).join(', ')})`);
  }
  const exists = cfg.ifNotExists ? ' IF NOT EXISTS' : '';
  return `CREATE TABLE${exists} ${ident(cfg.tableName)} (\n${lines.join(',\n')}\n);`;
}

// ─── 2. Drop Table ───────────────────────────────────────

export interface DropTableConfig {
  tableName: string;
  ifExists: boolean;
  cascade: boolean;
}

export function generateDropTable(cfg: DropTableConfig): string {
  if (!cfg.tableName) return '';
  const exists = cfg.ifExists ? ' IF EXISTS' : '';
  const cascade = cfg.cascade ? ' CASCADE' : '';
  return `DROP TABLE${exists} ${ident(cfg.tableName)}${cascade};`;
}

// ─── 3. Rename Table ─────────────────────────────────────

export interface RenameTableConfig {
  oldName: string;
  newName: string;
}

export function generateRenameTable(cfg: RenameTableConfig): string {
  if (!cfg.oldName || !cfg.newName) return '';
  return `ALTER TABLE ${ident(cfg.oldName)} RENAME TO ${ident(cfg.newName)};`;
}

// ─── 4. Add Column ───────────────────────────────────────

export interface AddColumnConfig {
  tableName: string;
  columnName: string;
  type: string;
  nullable: boolean;
  defaultValue: string;
}

export function generateAddColumn(cfg: AddColumnConfig): string {
  if (!cfg.tableName || !cfg.columnName || !cfg.type) return '';
  const parts = [`ALTER TABLE ${ident(cfg.tableName)} ADD COLUMN ${ident(cfg.columnName)} ${cfg.type}`];
  if (!cfg.nullable) parts.push('NOT NULL');
  if (cfg.defaultValue) parts.push(`DEFAULT ${cfg.defaultValue}`);
  return parts.join(' ') + ';';
}

// ─── 5. Drop Column ─────────────────────────────────────

export interface DropColumnConfig {
  tableName: string;
  columnName: string;
  ifExists: boolean;
}

export function generateDropColumn(cfg: DropColumnConfig): string {
  if (!cfg.tableName || !cfg.columnName) return '';
  const exists = cfg.ifExists ? ' IF EXISTS' : '';
  return `ALTER TABLE ${ident(cfg.tableName)} DROP COLUMN${exists} ${ident(cfg.columnName)};`;
}

// ─── 6. Rename Column ───────────────────────────────────

export interface RenameColumnConfig {
  tableName: string;
  oldName: string;
  newName: string;
}

export function generateRenameColumn(cfg: RenameColumnConfig): string {
  if (!cfg.tableName || !cfg.oldName || !cfg.newName) return '';
  return `ALTER TABLE ${ident(cfg.tableName)} RENAME COLUMN ${ident(cfg.oldName)} TO ${ident(cfg.newName)};`;
}

// ─── 7. Alter Column Type ────────────────────────────────

export interface AlterColumnTypeConfig {
  tableName: string;
  columnName: string;
  newType: string;
  usingExpression: string;
}

export function generateAlterColumnType(cfg: AlterColumnTypeConfig): string {
  if (!cfg.tableName || !cfg.columnName || !cfg.newType) return '';
  let sql = `ALTER TABLE ${ident(cfg.tableName)} ALTER COLUMN ${ident(cfg.columnName)} TYPE ${cfg.newType}`;
  if (cfg.usingExpression) sql += ` USING ${cfg.usingExpression}`;
  return sql + ';';
}

// ─── 8. Add Foreign Key ──────────────────────────────────

export interface AddForeignKeyConfig {
  tableName: string;
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
  constraintName: string;
  onDelete: string;
  onUpdate: string;
}

export function generateAddForeignKey(cfg: AddForeignKeyConfig): string {
  if (!cfg.tableName || !cfg.columnName || !cfg.referencedTable || !cfg.referencedColumn) return '';
  const name = cfg.constraintName || `fk_${cfg.tableName}_${cfg.columnName}`;
  let sql = `ALTER TABLE ${ident(cfg.tableName)} ADD CONSTRAINT ${ident(name)} FOREIGN KEY (${ident(cfg.columnName)}) REFERENCES ${ident(cfg.referencedTable)} (${ident(cfg.referencedColumn)})`;
  if (cfg.onDelete && cfg.onDelete !== 'NO ACTION') sql += ` ON DELETE ${cfg.onDelete}`;
  if (cfg.onUpdate && cfg.onUpdate !== 'NO ACTION') sql += ` ON UPDATE ${cfg.onUpdate}`;
  return sql + ';';
}

// ─── 9. Drop Constraint ─────────────────────────────────

export interface DropConstraintConfig {
  tableName: string;
  constraintName: string;
}

export function generateDropConstraint(cfg: DropConstraintConfig): string {
  if (!cfg.tableName || !cfg.constraintName) return '';
  return `ALTER TABLE ${ident(cfg.tableName)} DROP CONSTRAINT ${ident(cfg.constraintName)};`;
}

// ─── 10. Add NOT NULL ────────────────────────────────────

export interface AddNotNullConfig {
  tableName: string;
  columnName: string;
  defaultValue: string;
}

export function generateAddNotNull(cfg: AddNotNullConfig): string {
  if (!cfg.tableName || !cfg.columnName) return '';
  const lines: string[] = [];
  if (cfg.defaultValue) {
    lines.push(`UPDATE ${ident(cfg.tableName)} SET ${ident(cfg.columnName)} = ${cfg.defaultValue} WHERE ${ident(cfg.columnName)} IS NULL;`);
  }
  lines.push(`ALTER TABLE ${ident(cfg.tableName)} ALTER COLUMN ${ident(cfg.columnName)} SET NOT NULL;`);
  return lines.join('\n');
}

// ─── 11. Drop NOT NULL ───────────────────────────────────

export interface DropNotNullConfig {
  tableName: string;
  columnName: string;
}

export function generateDropNotNull(cfg: DropNotNullConfig): string {
  if (!cfg.tableName || !cfg.columnName) return '';
  return `ALTER TABLE ${ident(cfg.tableName)} ALTER COLUMN ${ident(cfg.columnName)} DROP NOT NULL;`;
}

// ─── 12. Create Index ────────────────────────────────────

export interface CreateIndexConfig {
  tableName: string;
  columns: string[];
  indexName: string;
  unique: boolean;
  concurrently: boolean;
  where: string;
}

export function generateCreateIndex(cfg: CreateIndexConfig): string {
  if (!cfg.tableName || cfg.columns.length === 0) return '';
  const name = cfg.indexName || `idx_${cfg.tableName}_${cfg.columns.join('_')}`;
  const unique = cfg.unique ? ' UNIQUE' : '';
  const concurrently = cfg.concurrently ? ' CONCURRENTLY' : '';
  let sql = `CREATE${unique} INDEX${concurrently} ${ident(name)} ON ${ident(cfg.tableName)} (${cfg.columns.map(ident).join(', ')})`;
  if (cfg.where) sql += ` WHERE ${cfg.where}`;
  return sql + ';';
}

// ─── 13. Drop Index ──────────────────────────────────────

export interface DropIndexConfig {
  indexName: string;
  ifExists: boolean;
  concurrently: boolean;
}

export function generateDropIndex(cfg: DropIndexConfig): string {
  if (!cfg.indexName) return '';
  const concurrently = cfg.concurrently ? ' CONCURRENTLY' : '';
  const exists = cfg.ifExists ? ' IF EXISTS' : '';
  return `DROP INDEX${concurrently}${exists} ${ident(cfg.indexName)};`;
}

// ─── 14. Create Enum ─────────────────────────────────────

export interface CreateEnumConfig {
  typeName: string;
  values: string[];
}

export function generateCreateEnum(cfg: CreateEnumConfig): string {
  if (!cfg.typeName || cfg.values.length === 0) return '';
  return `CREATE TYPE ${ident(cfg.typeName)} AS ENUM (${cfg.values.map(literal).join(', ')});`;
}

// ─── 15. Create View ─────────────────────────────────────

export interface CreateViewConfig {
  viewName: string;
  orReplace: boolean;
  query: string;
}

export function generateCreateView(cfg: CreateViewConfig): string {
  if (!cfg.viewName || !cfg.query) return '';
  const replace = cfg.orReplace ? ' OR REPLACE' : '';
  return `CREATE${replace} VIEW ${ident(cfg.viewName)} AS\n${cfg.query};`;
}

// ─── 16. Drop View ───────────────────────────────────────

export interface DropViewConfig {
  viewName: string;
  ifExists: boolean;
  cascade: boolean;
}

export function generateDropView(cfg: DropViewConfig): string {
  if (!cfg.viewName) return '';
  const exists = cfg.ifExists ? ' IF EXISTS' : '';
  const cascade = cfg.cascade ? ' CASCADE' : '';
  return `DROP VIEW${exists} ${ident(cfg.viewName)}${cascade};`;
}

// ─── 17. Generate Migration from Schema Diff ────────────

/**
 * Generates a complete migration SQL from a SchemaDiff.
 * Handles ordering: drop FKs → drop columns/tables → add tables/columns → alter columns → add FKs.
 */
export function generateMigrationFromDiff(diff: SchemaDiff): string {
  const statements: string[] = [];

  // Phase 1: Drop removed foreign keys (before dropping tables/columns they reference)
  for (const table of diff.modifiedTables) {
    for (const fk of table.removedForeignKeys) {
      statements.push(generateDropConstraint({
        tableName: table.tableName,
        constraintName: fk.constraintName,
      }));
    }
  }

  // Phase 2: Drop removed columns from modified tables
  for (const table of diff.modifiedTables) {
    for (const col of table.removedColumns) {
      statements.push(generateDropColumn({
        tableName: table.tableName,
        columnName: col.name,
        ifExists: false,
      }));
    }
  }

  // Phase 3: Drop removed tables (CASCADE to clean up remaining FKs)
  for (const table of diff.removedTables) {
    statements.push(generateDropTable({
      tableName: table.name,
      ifExists: true,
      cascade: true,
    }));
  }

  // Phase 4: Create added tables
  for (const table of diff.addedTables) {
    statements.push(generateCreateTable({
      tableName: table.name,
      ifNotExists: false,
      columns: table.columns.map(schemaColToColumnDef),
    }));
  }

  // Phase 5: Add new columns to modified tables
  for (const table of diff.modifiedTables) {
    for (const col of table.addedColumns) {
      statements.push(generateAddColumn({
        tableName: table.tableName,
        columnName: col.name,
        type: col.dataType.toUpperCase(),
        nullable: col.isNullable,
        defaultValue: col.columnDefault || '',
      }));
    }
  }

  // Phase 6: Alter modified columns
  for (const table of diff.modifiedTables) {
    for (const col of table.modifiedColumns) {
      // Type change
      if (col.before.dataType !== col.after.dataType) {
        statements.push(generateAlterColumnType({
          tableName: table.tableName,
          columnName: col.columnName,
          newType: col.after.dataType.toUpperCase(),
          usingExpression: '',
        }));
      }
      // Nullability change
      if (col.before.isNullable !== col.after.isNullable) {
        if (col.after.isNullable) {
          statements.push(generateDropNotNull({
            tableName: table.tableName,
            columnName: col.columnName,
          }));
        } else {
          statements.push(generateAddNotNull({
            tableName: table.tableName,
            columnName: col.columnName,
            defaultValue: '',
          }));
        }
      }
      // Default value change
      if (col.before.columnDefault !== col.after.columnDefault) {
        if (col.after.columnDefault) {
          statements.push(`ALTER TABLE ${ident(table.tableName)} ALTER COLUMN ${ident(col.columnName)} SET DEFAULT ${col.after.columnDefault};`);
        } else {
          statements.push(`ALTER TABLE ${ident(table.tableName)} ALTER COLUMN ${ident(col.columnName)} DROP DEFAULT;`);
        }
      }
    }
  }

  // Phase 7: Add foreign keys for new tables
  for (const table of diff.addedTables) {
    for (const fk of table.foreignKeys) {
      statements.push(generateAddForeignKey({
        tableName: table.name,
        columnName: fk.columnName,
        referencedTable: fk.referencedTable,
        referencedColumn: fk.referencedColumn,
        constraintName: fk.constraintName,
        onDelete: '',
        onUpdate: '',
      }));
    }
  }

  // Phase 8: Add new foreign keys on modified tables
  for (const table of diff.modifiedTables) {
    for (const fk of table.addedForeignKeys) {
      statements.push(generateAddForeignKey({
        tableName: table.tableName,
        columnName: fk.columnName,
        referencedTable: fk.referencedTable,
        referencedColumn: fk.referencedColumn,
        constraintName: fk.constraintName,
        onDelete: '',
        onUpdate: '',
      }));
    }
  }

  return statements.filter(Boolean).join('\n\n');
}

/** Convert a SchemaColumn to a ColumnDef for CREATE TABLE */
function schemaColToColumnDef(col: SchemaColumn): ColumnDef {
  return {
    name: col.name,
    type: col.dataType.toUpperCase(),
    nullable: col.isNullable,
    defaultValue: col.columnDefault || '',
    isPrimaryKey: col.isPrimaryKey,
  };
}
