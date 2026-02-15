import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import * as api from '@/api/client';
import type { SchemaSnapshotSummary, SchemaDiff, SchemaColumn, SchemaForeignKey, TableDiff, ColumnDiff } from '@shared/types';
import { ArrowLeft, GitCompareArrows, Plus, Minus, RefreshCw, Table2, Key, AlertTriangle, FileCode } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { generateMigrationFromDiff } from '@/lib/sql-generators';
import { useToast } from '@/components/ui/use-toast';

/**
 * Schema comparison page that shows diff between two schema snapshots.
 * Users select two snapshots from the history and see added/removed/modified tables.
 */
export function SchemaComparisonPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [snapshots, setSnapshots] = useState<SchemaSnapshotSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [beforeId, setBeforeId] = useState('');
  const [afterId, setAfterId] = useState('');
  const [diff, setDiff] = useState<SchemaDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    api
      .listSchemaSnapshots(projectId)
      .then((s) => {
        setSnapshots(s);
        // Auto-select the two most recent if available
        if (s.length >= 2) {
          setBeforeId(s[1].id);
          setAfterId(s[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleCompare = async () => {
    if (!beforeId || !afterId) return;
    setDiffLoading(true);
    setDiffError(null);
    setDiff(null);
    try {
      const result = await api.compareSchemaSnapshots(beforeId, afterId);
      setDiff(result);
    } catch (err: any) {
      setDiffError(err.message);
    } finally {
      setDiffLoading(false);
    }
  };

  // Auto-compare when both selected
  useEffect(() => {
    if (beforeId && afterId && beforeId !== afterId) {
      handleCompare();
    }
  }, [beforeId, afterId]);

  const handleGenerateMigration = async () => {
    if (!diff || !projectId) return;
    const sql = generateMigrationFromDiff(diff);
    if (!sql) {
      toast({ title: 'No changes', description: 'No SQL statements to generate from this diff.' });
      return;
    }
    setGenerating(true);
    try {
      const migration = await api.createMigration(projectId, {
        description: 'Schema diff migration',
        sqlContent: sql,
      });
      toast({ title: 'Migration created', description: `V${migration.version} created with ${sql.split('\n\n').length} statements.` });
      navigate(`/projects/${projectId}/migrations/${migration.id}`);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const hasChanges = diff && (
    diff.addedTables.length > 0 ||
    diff.removedTables.length > 0 ||
    diff.modifiedTables.length > 0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link to={`/projects/${projectId}`}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Project
          </Link>
        </Button>

        <div className="flex items-center gap-3">
          <GitCompareArrows className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Schema Comparison</h1>
        </div>
      </div>

      {snapshots.length < 2 ? (
        <div className="rounded-lg border-2 border-dashed border-border py-12 text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-medium text-foreground">Not enough snapshots</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Run at least two successful validations to compare schemas.
            {snapshots.length === 1 && ' You have 1 snapshot so far.'}
            {snapshots.length === 0 && ' No snapshots found.'}
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link to={`/projects/${projectId}/validate`}>Go to Validation</Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Snapshot selectors */}
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-foreground">Before (older)</label>
              <select
                value={beforeId}
                onChange={(e) => setBeforeId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Select snapshot...</option>
                {snapshots.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.id === afterId}>
                    {formatDate(s.capturedAt)} ({s.tableCount} tables)
                  </option>
                ))}
              </select>
            </div>

            <GitCompareArrows className="mb-1.5 h-5 w-5 shrink-0 text-muted-foreground" />

            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-foreground">After (newer)</label>
              <select
                value={afterId}
                onChange={(e) => setAfterId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Select snapshot...</option>
                {snapshots.map((s) => (
                  <option key={s.id} value={s.id} disabled={s.id === beforeId}>
                    {formatDate(s.capturedAt)} ({s.tableCount} tables)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {diffError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
              {diffError}
            </div>
          )}

          {diffLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          )}

          {diff && !diffLoading && (
            <>
              <Separator />

              {/* Summary badges */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-foreground">Changes:</span>
                {diff.addedTables.length > 0 && (
                  <Badge variant="success">
                    <Plus className="mr-1 h-3 w-3" />
                    {diff.addedTables.length} added
                  </Badge>
                )}
                {diff.removedTables.length > 0 && (
                  <Badge variant="destructive">
                    <Minus className="mr-1 h-3 w-3" />
                    {diff.removedTables.length} removed
                  </Badge>
                )}
                {diff.modifiedTables.length > 0 && (
                  <Badge variant="outline">
                    <RefreshCw className="mr-1 h-3 w-3" />
                    {diff.modifiedTables.length} modified
                  </Badge>
                )}
                {!hasChanges && (
                  <span className="text-sm text-muted-foreground">No differences found.</span>
                )}
                {hasChanges && (
                  <Button
                    size="sm"
                    className="ml-auto"
                    onClick={handleGenerateMigration}
                    disabled={generating}
                  >
                    <FileCode className="mr-1 h-4 w-4" />
                    {generating ? 'Generating...' : 'Generate Migration'}
                  </Button>
                )}
              </div>

              {/* Added tables */}
              {diff.addedTables.map((table) => (
                <div key={`add-${table.name}`} className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                  <div className="flex items-center gap-2 border-b border-green-200 px-4 py-2.5 dark:border-green-800">
                    <Plus className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <Table2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="font-semibold text-green-800 dark:text-green-200">{table.name}</span>
                    <Badge variant="success" className="ml-auto">Added</Badge>
                  </div>
                  <div className="px-4 py-2">
                    <ColumnTable columns={table.columns} variant="added" />
                    {table.foreignKeys.length > 0 && (
                      <ForeignKeyList fks={table.foreignKeys} variant="added" />
                    )}
                  </div>
                </div>
              ))}

              {/* Removed tables */}
              {diff.removedTables.map((table) => (
                <div key={`rem-${table.name}`} className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                  <div className="flex items-center gap-2 border-b border-red-200 px-4 py-2.5 dark:border-red-800">
                    <Minus className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <Table2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <span className="font-semibold text-red-800 dark:text-red-200">{table.name}</span>
                    <Badge variant="destructive" className="ml-auto">Removed</Badge>
                  </div>
                  <div className="px-4 py-2">
                    <ColumnTable columns={table.columns} variant="removed" />
                  </div>
                </div>
              ))}

              {/* Modified tables */}
              {diff.modifiedTables.map((tableDiff) => (
                <ModifiedTableCard key={`mod-${tableDiff.tableName}`} diff={tableDiff} />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

function ColumnTable({ columns, variant }: { columns: SchemaColumn[]; variant: 'added' | 'removed' | 'neutral' }) {
  const textClass = variant === 'added'
    ? 'text-green-700 dark:text-green-300'
    : variant === 'removed'
      ? 'text-red-700 dark:text-red-300'
      : 'text-foreground';

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className={`${textClass} opacity-70`}>
          <th className="py-1 pr-4 text-left font-medium">Column</th>
          <th className="py-1 pr-4 text-left font-medium">Type</th>
          <th className="py-1 pr-4 text-left font-medium">Nullable</th>
          <th className="py-1 text-left font-medium">Default</th>
        </tr>
      </thead>
      <tbody>
        {columns.map((col) => (
          <tr key={col.name} className={textClass}>
            <td className="py-0.5 pr-4 font-mono">
              {col.isPrimaryKey && <Key className="mr-1 inline h-3 w-3" />}
              {col.name}
            </td>
            <td className="py-0.5 pr-4 font-mono">{col.dataType}</td>
            <td className="py-0.5 pr-4">{col.isNullable ? 'YES' : 'NO'}</td>
            <td className="py-0.5 font-mono truncate max-w-[200px]">{col.columnDefault || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ForeignKeyList({ fks, variant }: { fks: SchemaForeignKey[]; variant: 'added' | 'removed' }) {
  const textClass = variant === 'added'
    ? 'text-green-700 dark:text-green-300'
    : 'text-red-700 dark:text-red-300';

  return (
    <div className={`mt-2 text-xs ${textClass}`}>
      <span className="font-medium opacity-70">Foreign Keys:</span>
      {fks.map((fk) => (
        <div key={fk.constraintName} className="ml-2 font-mono">
          {fk.columnName} -&gt; {fk.referencedTable}.{fk.referencedColumn}
        </div>
      ))}
    </div>
  );
}

function ModifiedTableCard({ diff }: { diff: TableDiff }) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
      <div className="flex items-center gap-2 border-b border-blue-200 px-4 py-2.5 dark:border-blue-800">
        <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <Table2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <span className="font-semibold text-blue-800 dark:text-blue-200">{diff.tableName}</span>
        <Badge variant="outline" className="ml-auto">Modified</Badge>
      </div>
      <div className="space-y-3 px-4 py-3">
        {/* Added columns */}
        {diff.addedColumns.length > 0 && (
          <div>
            <span className="text-xs font-medium text-green-700 dark:text-green-300">
              <Plus className="mr-1 inline h-3 w-3" />
              Added columns:
            </span>
            <ColumnTable columns={diff.addedColumns} variant="added" />
          </div>
        )}

        {/* Removed columns */}
        {diff.removedColumns.length > 0 && (
          <div>
            <span className="text-xs font-medium text-red-700 dark:text-red-300">
              <Minus className="mr-1 inline h-3 w-3" />
              Removed columns:
            </span>
            <ColumnTable columns={diff.removedColumns} variant="removed" />
          </div>
        )}

        {/* Modified columns */}
        {diff.modifiedColumns.length > 0 && (
          <div>
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
              <RefreshCw className="mr-1 inline h-3 w-3" />
              Modified columns:
            </span>
            {diff.modifiedColumns.map((col) => (
              <ModifiedColumnRow key={col.columnName} diff={col} />
            ))}
          </div>
        )}

        {/* Added foreign keys */}
        {diff.addedForeignKeys.length > 0 && (
          <ForeignKeyList fks={diff.addedForeignKeys} variant="added" />
        )}

        {/* Removed foreign keys */}
        {diff.removedForeignKeys.length > 0 && (
          <ForeignKeyList fks={diff.removedForeignKeys} variant="removed" />
        )}
      </div>
    </div>
  );
}

function ModifiedColumnRow({ diff }: { diff: ColumnDiff }) {
  const changes: string[] = [];
  if (diff.before.dataType !== diff.after.dataType) {
    changes.push(`type: ${diff.before.dataType} -> ${diff.after.dataType}`);
  }
  if (diff.before.isNullable !== diff.after.isNullable) {
    changes.push(`nullable: ${diff.before.isNullable ? 'YES' : 'NO'} -> ${diff.after.isNullable ? 'YES' : 'NO'}`);
  }
  if (diff.before.columnDefault !== diff.after.columnDefault) {
    changes.push(`default: ${diff.before.columnDefault || 'none'} -> ${diff.after.columnDefault || 'none'}`);
  }
  if (diff.before.isPrimaryKey !== diff.after.isPrimaryKey) {
    changes.push(`primary key: ${diff.before.isPrimaryKey ? 'YES' : 'NO'} -> ${diff.after.isPrimaryKey ? 'YES' : 'NO'}`);
  }

  return (
    <div className="ml-2 text-xs font-mono text-blue-700 dark:text-blue-300">
      <span className="font-semibold">{diff.columnName}</span>
      {changes.map((c, i) => (
        <span key={i} className="ml-2 opacity-80">
          [{c}]
        </span>
      ))}
    </div>
  );
}
