/**
 * Rollback SQL Generator — analyzes UP migration SQL and generates
 * corresponding DOWN (rollback) SQL statements.
 * Pure functions, no React dependencies.
 */

/** A parsed SQL statement with its type and metadata */
interface ParsedStatement {
  type: string;
  original: string;
  rollback: string;
}

/**
 * Strips SQL comments and string literals for safe parsing.
 */
function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, '');
}

/**
 * Splits SQL into individual statements, handling semicolons correctly.
 * Preserves statement boundaries even within string literals.
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inString = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

    if (ch === "'" && !inString) {
      inString = true;
      current += ch;
    } else if (ch === "'" && inString) {
      // Check for escaped quote ''
      if (i + 1 < sql.length && sql[i + 1] === "'") {
        current += "''";
        i++;
      } else {
        inString = false;
        current += ch;
      }
    } else if (ch === ';' && !inString) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
    } else {
      current += ch;
    }
  }

  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);

  return statements;
}

/**
 * Extracts an identifier from SQL, handling optional quoting.
 */
function extractIdent(s: string): string {
  const trimmed = s.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed;
  }
  return trimmed.replace(/"/g, '');
}

/**
 * Generates rollback SQL for a single statement.
 */
function generateRollbackForStatement(stmt: string): ParsedStatement {
  const cleaned = stripComments(stmt).trim();
  const upper = cleaned.toUpperCase();

  // CREATE TABLE [IF NOT EXISTS] <name> (...)
  const createTableMatch = cleaned.match(
    /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?("?\w+"?(?:\."?\w+"?)?)\s*\(/i
  );
  if (createTableMatch) {
    const tableName = extractIdent(createTableMatch[1]);
    return {
      type: 'CREATE TABLE',
      original: stmt,
      rollback: `DROP TABLE IF EXISTS ${tableName} CASCADE;`,
    };
  }

  // DROP TABLE [IF EXISTS] <name> [CASCADE|RESTRICT]
  // Cannot fully reverse — generate a comment
  const dropTableMatch = cleaned.match(
    /^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?("?\w+"?(?:\."?\w+"?)?)/i
  );
  if (dropTableMatch) {
    const tableName = extractIdent(dropTableMatch[1]);
    return {
      type: 'DROP TABLE',
      original: stmt,
      rollback: `-- TODO: Recreate table ${tableName} (original definition needed)`,
    };
  }

  // ALTER TABLE <name> ADD COLUMN [IF NOT EXISTS] <col> <type> [NOT NULL] [DEFAULT ...]
  const addColumnMatch = cleaned.match(
    /^ALTER\s+TABLE\s+("?\w+"?(?:\."?\w+"?)?)\s+ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?("?\w+"?)\s+/i
  );
  if (addColumnMatch && upper.includes('ADD') && !upper.includes('ADD CONSTRAINT')) {
    const tableName = extractIdent(addColumnMatch[1]);
    const colName = extractIdent(addColumnMatch[2]);
    return {
      type: 'ADD COLUMN',
      original: stmt,
      rollback: `ALTER TABLE ${tableName} DROP COLUMN IF EXISTS ${colName};`,
    };
  }

  // ALTER TABLE <name> DROP COLUMN [IF EXISTS] <col>
  const dropColumnMatch = cleaned.match(
    /^ALTER\s+TABLE\s+("?\w+"?(?:\."?\w+"?)?)\s+DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?("?\w+"?)/i
  );
  if (dropColumnMatch) {
    const tableName = extractIdent(dropColumnMatch[1]);
    const colName = extractIdent(dropColumnMatch[2]);
    return {
      type: 'DROP COLUMN',
      original: stmt,
      rollback: `-- TODO: Re-add column ${colName} to ${tableName} (original type needed)`,
    };
  }

  // ALTER TABLE <name> RENAME COLUMN <old> TO <new>
  const renameColMatch = cleaned.match(
    /^ALTER\s+TABLE\s+("?\w+"?(?:\."?\w+"?)?)\s+RENAME\s+COLUMN\s+("?\w+"?)\s+TO\s+("?\w+"?)/i
  );
  if (renameColMatch) {
    const tableName = extractIdent(renameColMatch[1]);
    const oldName = extractIdent(renameColMatch[2]);
    const newName = extractIdent(renameColMatch[3]);
    return {
      type: 'RENAME COLUMN',
      original: stmt,
      rollback: `ALTER TABLE ${tableName} RENAME COLUMN ${newName} TO ${oldName};`,
    };
  }

  // ALTER TABLE <name> RENAME TO <new>
  const renameTableMatch = cleaned.match(
    /^ALTER\s+TABLE\s+("?\w+"?(?:\."?\w+"?)?)\s+RENAME\s+TO\s+("?\w+"?)/i
  );
  if (renameTableMatch) {
    const oldName = extractIdent(renameTableMatch[1]);
    const newName = extractIdent(renameTableMatch[2]);
    return {
      type: 'RENAME TABLE',
      original: stmt,
      rollback: `ALTER TABLE ${newName} RENAME TO ${oldName};`,
    };
  }

  // ALTER TABLE <name> ALTER COLUMN <col> TYPE <type>
  const alterTypeMatch = cleaned.match(
    /^ALTER\s+TABLE\s+("?\w+"?(?:\."?\w+"?)?)\s+ALTER\s+COLUMN\s+("?\w+"?)\s+(?:SET\s+DATA\s+)?TYPE\s+(\w+)/i
  );
  if (alterTypeMatch) {
    const tableName = extractIdent(alterTypeMatch[1]);
    const colName = extractIdent(alterTypeMatch[2]);
    return {
      type: 'ALTER COLUMN TYPE',
      original: stmt,
      rollback: `-- TODO: ALTER TABLE ${tableName} ALTER COLUMN ${colName} TYPE <original_type>;`,
    };
  }

  // ALTER TABLE <name> ALTER COLUMN <col> SET NOT NULL
  const setNotNullMatch = cleaned.match(
    /^ALTER\s+TABLE\s+("?\w+"?(?:\."?\w+"?)?)\s+ALTER\s+COLUMN\s+("?\w+"?)\s+SET\s+NOT\s+NULL/i
  );
  if (setNotNullMatch) {
    const tableName = extractIdent(setNotNullMatch[1]);
    const colName = extractIdent(setNotNullMatch[2]);
    return {
      type: 'SET NOT NULL',
      original: stmt,
      rollback: `ALTER TABLE ${tableName} ALTER COLUMN ${colName} DROP NOT NULL;`,
    };
  }

  // ALTER TABLE <name> ALTER COLUMN <col> DROP NOT NULL
  const dropNotNullMatch = cleaned.match(
    /^ALTER\s+TABLE\s+("?\w+"?(?:\."?\w+"?)?)\s+ALTER\s+COLUMN\s+("?\w+"?)\s+DROP\s+NOT\s+NULL/i
  );
  if (dropNotNullMatch) {
    const tableName = extractIdent(dropNotNullMatch[1]);
    const colName = extractIdent(dropNotNullMatch[2]);
    return {
      type: 'DROP NOT NULL',
      original: stmt,
      rollback: `ALTER TABLE ${tableName} ALTER COLUMN ${colName} SET NOT NULL;`,
    };
  }

  // ALTER TABLE <name> ALTER COLUMN <col> SET DEFAULT <val>
  const setDefaultMatch = cleaned.match(
    /^ALTER\s+TABLE\s+("?\w+"?(?:\."?\w+"?)?)\s+ALTER\s+COLUMN\s+("?\w+"?)\s+SET\s+DEFAULT/i
  );
  if (setDefaultMatch) {
    const tableName = extractIdent(setDefaultMatch[1]);
    const colName = extractIdent(setDefaultMatch[2]);
    return {
      type: 'SET DEFAULT',
      original: stmt,
      rollback: `ALTER TABLE ${tableName} ALTER COLUMN ${colName} DROP DEFAULT;`,
    };
  }

  // ALTER TABLE <name> ALTER COLUMN <col> DROP DEFAULT
  const dropDefaultMatch = cleaned.match(
    /^ALTER\s+TABLE\s+("?\w+"?(?:\."?\w+"?)?)\s+ALTER\s+COLUMN\s+("?\w+"?)\s+DROP\s+DEFAULT/i
  );
  if (dropDefaultMatch) {
    const tableName = extractIdent(dropDefaultMatch[1]);
    const colName = extractIdent(dropDefaultMatch[2]);
    return {
      type: 'DROP DEFAULT',
      original: stmt,
      rollback: `-- TODO: ALTER TABLE ${tableName} ALTER COLUMN ${colName} SET DEFAULT <original_default>;`,
    };
  }

  // ALTER TABLE <name> ADD CONSTRAINT <name> FOREIGN KEY (...)
  const addFkMatch = cleaned.match(
    /^ALTER\s+TABLE\s+("?\w+"?(?:\."?\w+"?)?)\s+ADD\s+CONSTRAINT\s+("?\w+"?)/i
  );
  if (addFkMatch) {
    const tableName = extractIdent(addFkMatch[1]);
    const constraintName = extractIdent(addFkMatch[2]);
    return {
      type: 'ADD CONSTRAINT',
      original: stmt,
      rollback: `ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${constraintName};`,
    };
  }

  // ALTER TABLE <name> DROP CONSTRAINT [IF EXISTS] <name>
  const dropConstraintMatch = cleaned.match(
    /^ALTER\s+TABLE\s+("?\w+"?(?:\."?\w+"?)?)\s+DROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?("?\w+"?)/i
  );
  if (dropConstraintMatch) {
    const tableName = extractIdent(dropConstraintMatch[1]);
    const constraintName = extractIdent(dropConstraintMatch[2]);
    return {
      type: 'DROP CONSTRAINT',
      original: stmt,
      rollback: `-- TODO: Re-add constraint ${constraintName} on ${tableName} (original definition needed)`,
    };
  }

  // CREATE [UNIQUE] INDEX [CONCURRENTLY] [IF NOT EXISTS] <name> ON <table> (...)
  const createIndexMatch = cleaned.match(
    /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?("?\w+"?)\s+ON/i
  );
  if (createIndexMatch) {
    const indexName = extractIdent(createIndexMatch[1]);
    return {
      type: 'CREATE INDEX',
      original: stmt,
      rollback: `DROP INDEX IF EXISTS ${indexName};`,
    };
  }

  // DROP INDEX [CONCURRENTLY] [IF EXISTS] <name>
  const dropIndexMatch = cleaned.match(
    /^DROP\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+EXISTS\s+)?("?\w+"?)/i
  );
  if (dropIndexMatch) {
    const indexName = extractIdent(dropIndexMatch[1]);
    return {
      type: 'DROP INDEX',
      original: stmt,
      rollback: `-- TODO: Recreate index ${indexName} (original definition needed)`,
    };
  }

  // CREATE TYPE <name> AS ENUM (...)
  const createEnumMatch = cleaned.match(
    /^CREATE\s+TYPE\s+("?\w+"?(?:\."?\w+"?)?)\s+AS\s+ENUM/i
  );
  if (createEnumMatch) {
    const typeName = extractIdent(createEnumMatch[1]);
    return {
      type: 'CREATE TYPE',
      original: stmt,
      rollback: `DROP TYPE IF EXISTS ${typeName};`,
    };
  }

  // CREATE [OR REPLACE] VIEW <name> AS ...
  const createViewMatch = cleaned.match(
    /^CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+("?\w+"?(?:\."?\w+"?)?)\s+AS/i
  );
  if (createViewMatch) {
    const viewName = extractIdent(createViewMatch[1]);
    return {
      type: 'CREATE VIEW',
      original: stmt,
      rollback: `DROP VIEW IF EXISTS ${viewName};`,
    };
  }

  // DROP VIEW [IF EXISTS] <name>
  const dropViewMatch = cleaned.match(
    /^DROP\s+VIEW\s+(?:IF\s+EXISTS\s+)?("?\w+"?(?:\."?\w+"?)?)/i
  );
  if (dropViewMatch) {
    const viewName = extractIdent(dropViewMatch[1]);
    return {
      type: 'DROP VIEW',
      original: stmt,
      rollback: `-- TODO: Recreate view ${viewName} (original definition needed)`,
    };
  }

  // Fallback: unknown statement
  return {
    type: 'UNKNOWN',
    original: stmt,
    rollback: `-- TODO: Manually write rollback for:\n-- ${stmt.split('\n').join('\n-- ')}`,
  };
}

/**
 * Generates rollback (DOWN) SQL from UP migration SQL.
 * Statements are reversed so the rollback undoes changes in reverse order.
 *
 * @param upSql - The UP migration SQL content
 * @returns The generated DOWN (rollback) SQL
 */
export function generateRollbackSql(upSql: string): string {
  if (!upSql.trim()) return '';

  const statements = splitStatements(upSql);
  const parsed = statements
    .map(generateRollbackForStatement)
    .filter((p) => p.rollback);

  // Reverse order: last UP statement should be first to undo
  parsed.reverse();

  const header = '-- Auto-generated rollback SQL\n-- Review carefully before executing\n';
  return header + parsed.map((p) => p.rollback).join('\n\n');
}
