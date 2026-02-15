/**
 * SQL Dry Run Analyzer — parses SQL and generates a detailed
 * "what would happen" report without executing anything.
 * Pure functions, no React dependencies.
 */

export type OperationType =
  | 'CREATE TABLE'
  | 'DROP TABLE'
  | 'ALTER TABLE'
  | 'CREATE INDEX'
  | 'DROP INDEX'
  | 'CREATE VIEW'
  | 'DROP VIEW'
  | 'CREATE TYPE'
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE'
  | 'OTHER';

export interface DryRunOperation {
  type: OperationType;
  target: string; // table/index/view name
  detail: string; // human-readable description
  line: number;
  reversible: boolean;
}

export interface DryRunReport {
  operations: DryRunOperation[];
  tablesCreated: string[];
  tablesDropped: string[];
  tablesModified: string[];
  indexesCreated: string[];
  indexesDropped: string[];
  dataModifications: number; // count of INSERT/UPDATE/DELETE
  isFullyReversible: boolean;
  estimatedRisk: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Analyzes SQL and produces a dry-run report.
 */
export function analyzeDryRun(sql: string): DryRunReport {
  if (!sql.trim()) {
    return {
      operations: [],
      tablesCreated: [],
      tablesDropped: [],
      tablesModified: [],
      indexesCreated: [],
      indexesDropped: [],
      dataModifications: 0,
      isFullyReversible: true,
      estimatedRisk: 'low',
    };
  }

  const operations: DryRunOperation[] = [];
  const tablesCreated = new Set<string>();
  const tablesDropped = new Set<string>();
  const tablesModified = new Set<string>();
  const indexesCreated = new Set<string>();
  const indexesDropped = new Set<string>();
  let dataModifications = 0;

  // Strip comments but keep line numbers
  const lines = sql.split('\n');

  // Find statements with line numbers
  let currentStmt = '';
  let stmtStartLine = 1;
  let inString = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
      .replace(/--.*$/, '') // strip line comments
      .trim();

    if (!line) continue;

    if (!currentStmt.trim()) stmtStartLine = i + 1;

    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === "'" && !inString) {
        inString = true;
        currentStmt += ch;
      } else if (ch === "'" && inString) {
        inString = false;
        currentStmt += ch;
      } else if (ch === ';' && !inString) {
        const stmt = currentStmt.trim();
        if (stmt) {
          const op = parseStatement(stmt, stmtStartLine);
          if (op) {
            operations.push(op);
            categorizeOp(op, tablesCreated, tablesDropped, tablesModified, indexesCreated, indexesDropped);
            if (op.type === 'INSERT' || op.type === 'UPDATE' || op.type === 'DELETE') {
              dataModifications++;
            }
          }
        }
        currentStmt = '';
        stmtStartLine = i + 1;
      } else {
        currentStmt += ch;
      }
    }
    currentStmt += ' ';
  }

  // Handle last statement without semicolon
  const lastStmt = currentStmt.trim();
  if (lastStmt) {
    const op = parseStatement(lastStmt, stmtStartLine);
    if (op) {
      operations.push(op);
      categorizeOp(op, tablesCreated, tablesDropped, tablesModified, indexesCreated, indexesDropped);
      if (op.type === 'INSERT' || op.type === 'UPDATE' || op.type === 'DELETE') {
        dataModifications++;
      }
    }
  }

  const isFullyReversible = operations.every((op) => op.reversible);
  const estimatedRisk = calculateRisk(operations, tablesDropped.size, dataModifications);

  return {
    operations,
    tablesCreated: [...tablesCreated],
    tablesDropped: [...tablesDropped],
    tablesModified: [...tablesModified],
    indexesCreated: [...indexesCreated],
    indexesDropped: [...indexesDropped],
    dataModifications,
    isFullyReversible,
    estimatedRisk,
  };
}

function extractName(match: string): string {
  return match.replace(/"/g, '').toLowerCase();
}

function parseStatement(stmt: string, line: number): DryRunOperation | null {
  const upper = stmt.toUpperCase().replace(/\s+/g, ' ').trim();

  // CREATE TABLE
  let match = stmt.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:\w+\.)?("?\w+"?)/i);
  if (match) {
    return {
      type: 'CREATE TABLE',
      target: extractName(match[1]),
      detail: `Creates table "${extractName(match[1])}"`,
      line,
      reversible: true,
    };
  }

  // DROP TABLE
  match = stmt.match(/^DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:\w+\.)?("?\w+"?)/i);
  if (match) {
    return {
      type: 'DROP TABLE',
      target: extractName(match[1]),
      detail: `Drops table "${extractName(match[1])}" and all its data`,
      line,
      reversible: false,
    };
  }

  // ALTER TABLE
  match = stmt.match(/^ALTER\s+TABLE\s+(?:ONLY\s+)?(?:\w+\.)?("?\w+"?)\s+(.+)/i);
  if (match) {
    const table = extractName(match[1]);
    const action = match[2].trim();
    const upperAction = action.toUpperCase();

    let detail = `Alters table "${table}"`;
    let reversible = true;

    if (/^ADD\s+COLUMN/i.test(action)) {
      const colMatch = action.match(/^ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?("?\w+"?)/i);
      detail = `Adds column "${colMatch ? extractName(colMatch[1]) : '?'}" to "${table}"`;
    } else if (/^DROP\s+COLUMN/i.test(action)) {
      const colMatch = action.match(/^DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?("?\w+"?)/i);
      detail = `Drops column "${colMatch ? extractName(colMatch[1]) : '?'}" from "${table}"`;
      reversible = false;
    } else if (/^RENAME\s+COLUMN/i.test(action)) {
      detail = `Renames a column in "${table}"`;
    } else if (/^RENAME\s+TO/i.test(action)) {
      detail = `Renames table "${table}"`;
    } else if (/^ADD\s+CONSTRAINT/i.test(action)) {
      detail = `Adds a constraint on "${table}"`;
    } else if (/^DROP\s+CONSTRAINT/i.test(action)) {
      detail = `Drops a constraint from "${table}"`;
      reversible = false;
    } else if (/ALTER\s+COLUMN.*TYPE/i.test(upperAction)) {
      detail = `Changes a column type in "${table}"`;
      reversible = false;
    } else if (/ALTER\s+COLUMN.*SET\s+NOT\s+NULL/i.test(upperAction)) {
      detail = `Sets column NOT NULL in "${table}"`;
    } else if (/ALTER\s+COLUMN.*DROP\s+NOT\s+NULL/i.test(upperAction)) {
      detail = `Drops NOT NULL constraint in "${table}"`;
    } else if (/ALTER\s+COLUMN.*SET\s+DEFAULT/i.test(upperAction)) {
      detail = `Sets column default in "${table}"`;
    } else if (/ALTER\s+COLUMN.*DROP\s+DEFAULT/i.test(upperAction)) {
      detail = `Drops column default in "${table}"`;
    } else if (/ENABLE\s+ROW\s+LEVEL/i.test(upperAction)) {
      detail = `Enables Row Level Security on "${table}"`;
    }

    return { type: 'ALTER TABLE', target: table, detail, line, reversible };
  }

  // CREATE INDEX
  match = stmt.match(/^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?("?\w+"?)\s+ON\s+(?:\w+\.)?("?\w+"?)/i);
  if (match) {
    return {
      type: 'CREATE INDEX',
      target: extractName(match[1]),
      detail: `Creates index "${extractName(match[1])}" on "${extractName(match[2])}"`,
      line,
      reversible: true,
    };
  }

  // DROP INDEX
  match = stmt.match(/^DROP\s+INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+EXISTS\s+)?("?\w+"?)/i);
  if (match) {
    return {
      type: 'DROP INDEX',
      target: extractName(match[1]),
      detail: `Drops index "${extractName(match[1])}"`,
      line,
      reversible: false,
    };
  }

  // CREATE VIEW
  match = stmt.match(/^CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+(?:\w+\.)?("?\w+"?)/i);
  if (match) {
    return {
      type: 'CREATE VIEW',
      target: extractName(match[1]),
      detail: `Creates view "${extractName(match[1])}"`,
      line,
      reversible: true,
    };
  }

  // DROP VIEW
  match = stmt.match(/^DROP\s+(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+EXISTS\s+)?(?:\w+\.)?("?\w+"?)/i);
  if (match) {
    return {
      type: 'DROP VIEW',
      target: extractName(match[1]),
      detail: `Drops view "${extractName(match[1])}"`,
      line,
      reversible: false,
    };
  }

  // CREATE TYPE
  match = stmt.match(/^CREATE\s+TYPE\s+(?:\w+\.)?("?\w+"?)/i);
  if (match) {
    return {
      type: 'CREATE TYPE',
      target: extractName(match[1]),
      detail: `Creates type "${extractName(match[1])}"`,
      line,
      reversible: true,
    };
  }

  // INSERT
  match = stmt.match(/^INSERT\s+INTO\s+(?:\w+\.)?("?\w+"?)/i);
  if (match) {
    return {
      type: 'INSERT',
      target: extractName(match[1]),
      detail: `Inserts data into "${extractName(match[1])}"`,
      line,
      reversible: false,
    };
  }

  // UPDATE
  match = stmt.match(/^UPDATE\s+(?:\w+\.)?("?\w+"?)\s+SET/i);
  if (match) {
    const hasWhere = /\bWHERE\b/i.test(stmt);
    return {
      type: 'UPDATE',
      target: extractName(match[1]),
      detail: `Updates rows in "${extractName(match[1])}"${hasWhere ? '' : ' (ALL rows)'}`,
      line,
      reversible: false,
    };
  }

  // DELETE
  match = stmt.match(/^DELETE\s+FROM\s+(?:\w+\.)?("?\w+"?)/i);
  if (match) {
    const hasWhere = /\bWHERE\b/i.test(stmt);
    return {
      type: 'DELETE',
      target: extractName(match[1]),
      detail: `Deletes rows from "${extractName(match[1])}"${hasWhere ? '' : ' (ALL rows)'}`,
      line,
      reversible: false,
    };
  }

  // Other (CREATE FUNCTION, GRANT, etc.)
  if (upper.startsWith('CREATE ') || upper.startsWith('DROP ') || upper.startsWith('GRANT ') || upper.startsWith('REVOKE ') || upper.startsWith('TRUNCATE')) {
    return {
      type: 'OTHER',
      target: '',
      detail: stmt.slice(0, 60) + (stmt.length > 60 ? '...' : ''),
      line,
      reversible: false,
    };
  }

  return null;
}

function categorizeOp(
  op: DryRunOperation,
  created: Set<string>,
  dropped: Set<string>,
  modified: Set<string>,
  idxCreated: Set<string>,
  idxDropped: Set<string>
) {
  switch (op.type) {
    case 'CREATE TABLE':
      created.add(op.target);
      break;
    case 'DROP TABLE':
      dropped.add(op.target);
      break;
    case 'ALTER TABLE':
    case 'INSERT':
    case 'UPDATE':
    case 'DELETE':
      modified.add(op.target);
      break;
    case 'CREATE INDEX':
      idxCreated.add(op.target);
      break;
    case 'DROP INDEX':
      idxDropped.add(op.target);
      break;
  }
}

function calculateRisk(
  ops: DryRunOperation[],
  droppedCount: number,
  _dataModCount: number
): DryRunReport['estimatedRisk'] {
  if (droppedCount > 0) return 'critical';
  if (ops.some((o) => o.type === 'DELETE' || o.type === 'UPDATE')) return 'high';
  if (ops.some((o) => !o.reversible)) return 'medium';
  return 'low';
}
