/**
 * SQL Safety Analyzer — parses migration SQL and flags risky operations.
 * Runs in both backend and frontend (pure string analysis, no DB needed).
 */

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export interface SqlLintIssue {
  rule: string;
  severity: RiskLevel;
  message: string;
  line: number | null;
  suggestion: string;
}

export interface SqlAnalysisResult {
  overallRisk: RiskLevel;
  issues: SqlLintIssue[];
}

/** Strips SQL comments (-- and /* ... *​/) and string literals to avoid false positives */
function stripCommentsAndStrings(sql: string): string {
  // Replace string literals with placeholder
  let result = sql.replace(/'(?:[^']|'')*'/g, "'__STR__'");
  // Remove block comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // Remove line comments
  result = result.replace(/--.*$/gm, '');
  return result;
}

/** Returns the line number (1-based) where a match occurs in the original SQL */
function findLineNumber(sql: string, pattern: RegExp): number | null {
  const match = sql.match(pattern);
  if (!match || match.index === undefined) return null;
  return sql.substring(0, match.index).split('\n').length;
}

/** All lint rules applied to migration SQL */
const RULES: Array<{
  id: string;
  check: (sql: string, original: string) => SqlLintIssue | null;
}> = [
  {
    id: 'drop-table',
    check: (sql, original) => {
      const pattern = /\bDROP\s+TABLE\b/i;
      if (!pattern.test(sql)) return null;
      return {
        rule: 'drop-table',
        severity: 'critical',
        message: 'DROP TABLE detected — this permanently deletes a table and all its data.',
        line: findLineNumber(original, pattern),
        suggestion: 'Consider renaming the table instead, or ensure a backup exists.',
      };
    },
  },
  {
    id: 'drop-column',
    check: (sql, original) => {
      const pattern = /\bDROP\s+COLUMN\b/i;
      if (!pattern.test(sql)) return null;
      return {
        rule: 'drop-column',
        severity: 'critical',
        message: 'DROP COLUMN detected — this permanently removes a column and its data.',
        line: findLineNumber(original, pattern),
        suggestion: 'Consider marking the column as deprecated first, or create a backup.',
      };
    },
  },
  {
    id: 'drop-database',
    check: (sql, original) => {
      const pattern = /\bDROP\s+DATABASE\b/i;
      if (!pattern.test(sql)) return null;
      return {
        rule: 'drop-database',
        severity: 'critical',
        message: 'DROP DATABASE detected — this destroys the entire database.',
        line: findLineNumber(original, pattern),
        suggestion: 'This should almost never appear in a migration file.',
      };
    },
  },
  {
    id: 'truncate-table',
    check: (sql, original) => {
      const pattern = /\bTRUNCATE\b/i;
      if (!pattern.test(sql)) return null;
      return {
        rule: 'truncate-table',
        severity: 'critical',
        message: 'TRUNCATE detected — this removes all rows from a table irreversibly.',
        line: findLineNumber(original, pattern),
        suggestion: 'Use DELETE with a WHERE clause for selective removal, or ensure this is intentional.',
      };
    },
  },
  {
    id: 'not-null-no-default',
    check: (sql, original) => {
      // Match ADD COLUMN ... NOT NULL without DEFAULT
      const pattern = /\bADD\s+(?:COLUMN\s+)?\w+\s+\w+[^;]*\bNOT\s+NULL\b/i;
      const defaultPattern = /\bADD\s+(?:COLUMN\s+)?\w+\s+\w+[^;]*\bNOT\s+NULL\b[^;]*\bDEFAULT\b/i;
      if (!pattern.test(sql) || defaultPattern.test(sql)) return null;
      return {
        rule: 'not-null-no-default',
        severity: 'high',
        message: 'ADD COLUMN with NOT NULL but no DEFAULT — will fail if the table has existing rows.',
        line: findLineNumber(original, pattern),
        suggestion: 'Add a DEFAULT value, or make the column nullable first and backfill.',
      };
    },
  },
  {
    id: 'index-not-concurrent',
    check: (sql, original) => {
      // CREATE INDEX (not CONCURRENTLY) on a table
      const pattern = /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/i;
      const concurrentPattern = /\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b/i;
      if (!pattern.test(sql) || concurrentPattern.test(sql)) return null;
      return {
        rule: 'index-not-concurrent',
        severity: 'medium',
        message: 'CREATE INDEX without CONCURRENTLY — locks the table for writes during creation.',
        line: findLineNumber(original, pattern),
        suggestion: 'Use CREATE INDEX CONCURRENTLY to avoid blocking writes on large tables.',
      };
    },
  },
  {
    id: 'create-no-if-not-exists',
    check: (sql, original) => {
      // CREATE TABLE without IF NOT EXISTS
      const createPattern = /\bCREATE\s+TABLE\b/i;
      const safePattern = /\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/i;
      if (!createPattern.test(sql) || safePattern.test(sql)) return null;
      return {
        rule: 'create-no-if-not-exists',
        severity: 'low',
        message: 'CREATE TABLE without IF NOT EXISTS — will fail if the table already exists.',
        line: findLineNumber(original, createPattern),
        suggestion: 'Add IF NOT EXISTS for idempotent migrations.',
      };
    },
  },
  {
    id: 'drop-no-if-exists',
    check: (sql, original) => {
      const dropPattern = /\bDROP\s+(?:TABLE|INDEX|VIEW|SEQUENCE|TYPE|FUNCTION)\b/i;
      const safePattern = /\bDROP\s+(?:TABLE|INDEX|VIEW|SEQUENCE|TYPE|FUNCTION)\s+IF\s+EXISTS\b/i;
      if (!dropPattern.test(sql) || safePattern.test(sql)) return null;
      return {
        rule: 'drop-no-if-exists',
        severity: 'low',
        message: 'DROP without IF EXISTS — will fail if the object does not exist.',
        line: findLineNumber(original, dropPattern),
        suggestion: 'Add IF EXISTS for idempotent migrations.',
      };
    },
  },
  {
    id: 'alter-type',
    check: (sql, original) => {
      const pattern = /\bALTER\s+(?:TABLE\s+\w+\s+ALTER\s+COLUMN\s+\w+\s+(?:SET\s+DATA\s+)?TYPE|COLUMN\s+\w+\s+TYPE)\b/i;
      if (!pattern.test(sql)) return null;
      return {
        rule: 'alter-type',
        severity: 'high',
        message: 'Column type change detected — may fail or lose data on existing rows.',
        line: findLineNumber(original, pattern),
        suggestion: 'Consider creating a new column, copying data, then dropping the old column.',
      };
    },
  },
  {
    id: 'rename-column',
    check: (sql, original) => {
      const pattern = /\bRENAME\s+COLUMN\b/i;
      if (!pattern.test(sql)) return null;
      return {
        rule: 'rename-column',
        severity: 'high',
        message: 'RENAME COLUMN detected — will break application queries referencing the old name.',
        line: findLineNumber(original, pattern),
        suggestion: 'Update application code before deploying, or use a view for backward compatibility.',
      };
    },
  },
  {
    id: 'rename-table',
    check: (sql, original) => {
      const pattern = /\bRENAME\s+TO\b/i;
      // Only flag if it's ALTER TABLE ... RENAME TO
      const tableRename = /\bALTER\s+TABLE\s+\w+\s+RENAME\s+TO\b/i;
      if (!tableRename.test(sql)) return null;
      return {
        rule: 'rename-table',
        severity: 'high',
        message: 'Table rename detected — will break application queries referencing the old name.',
        line: findLineNumber(original, tableRename),
        suggestion: 'Update application code and consider creating a view with the old name.',
      };
    },
  },
  {
    id: 'add-constraint-not-valid',
    check: (sql, original) => {
      // ADD CONSTRAINT ... FOREIGN KEY or CHECK without NOT VALID
      const pattern = /\bADD\s+CONSTRAINT\b[^;]*\b(?:FOREIGN\s+KEY|CHECK)\b/i;
      const notValidPattern = /\bADD\s+CONSTRAINT\b[^;]*\b(?:FOREIGN\s+KEY|CHECK)\b[^;]*\bNOT\s+VALID\b/i;
      if (!pattern.test(sql) || notValidPattern.test(sql)) return null;
      return {
        rule: 'add-constraint-not-valid',
        severity: 'medium',
        message: 'ADD CONSTRAINT without NOT VALID — acquires a lock and scans the entire table.',
        line: findLineNumber(original, pattern),
        suggestion: 'Add NOT VALID, then VALIDATE CONSTRAINT in a separate migration.',
      };
    },
  },
  {
    id: 'update-without-where',
    check: (sql, original) => {
      // UPDATE ... SET without WHERE
      const updatePattern = /\bUPDATE\s+\w+\s+SET\b/i;
      if (!updatePattern.test(sql)) return null;
      // Check if there's a WHERE clause after SET
      const updateWithWhere = /\bUPDATE\s+\w+\s+SET\b[^;]*\bWHERE\b/i;
      if (updateWithWhere.test(sql)) return null;
      return {
        rule: 'update-without-where',
        severity: 'medium',
        message: 'UPDATE without WHERE clause — will modify every row in the table.',
        line: findLineNumber(original, updatePattern),
        suggestion: 'Add a WHERE clause to limit the scope, or add a comment confirming this is intentional.',
      };
    },
  },
  {
    id: 'delete-without-where',
    check: (sql, original) => {
      const deletePattern = /\bDELETE\s+FROM\s+\w+/i;
      if (!deletePattern.test(sql)) return null;
      const deleteWithWhere = /\bDELETE\s+FROM\s+\w+[^;]*\bWHERE\b/i;
      if (deleteWithWhere.test(sql)) return null;
      return {
        rule: 'delete-without-where',
        severity: 'medium',
        message: 'DELETE without WHERE clause — will remove all rows from the table.',
        line: findLineNumber(original, deletePattern),
        suggestion: 'Add a WHERE clause, or use TRUNCATE if you intend to clear the table.',
      };
    },
  },
  {
    id: 'grant-all',
    check: (sql, original) => {
      const pattern = /\bGRANT\s+ALL\b/i;
      if (!pattern.test(sql)) return null;
      return {
        rule: 'grant-all',
        severity: 'medium',
        message: 'GRANT ALL detected — grants all privileges which may be overly permissive.',
        line: findLineNumber(original, pattern),
        suggestion: 'Grant only the specific privileges needed (SELECT, INSERT, UPDATE, etc.).',
      };
    },
  },
];

/**
 * Analyzes SQL migration content for safety issues.
 * @param sqlContent - The raw SQL string to analyze
 * @returns Analysis result with overall risk level and list of issues
 */
export function analyzeSql(sqlContent: string): SqlAnalysisResult {
  const stripped = stripCommentsAndStrings(sqlContent);
  const issues: SqlLintIssue[] = [];

  for (const rule of RULES) {
    const issue = rule.check(stripped, sqlContent);
    if (issue) {
      issues.push(issue);
    }
  }

  // Determine overall risk: take the highest severity found
  let overallRisk: RiskLevel = 'low';
  const severityOrder: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
  for (const issue of issues) {
    if (severityOrder.indexOf(issue.severity) > severityOrder.indexOf(overallRisk)) {
      overallRisk = issue.severity;
    }
  }

  // If no issues found, risk is 'low' (safe)
  return { overallRisk: issues.length === 0 ? 'low' : overallRisk, issues };
}
