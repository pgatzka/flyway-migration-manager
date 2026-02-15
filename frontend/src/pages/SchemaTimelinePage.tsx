import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import * as api from '@/api/client';
import type { SchemaSnapshotSummary, SchemaDiff } from '@shared/types';
import { ArrowLeft, Clock, GitCompareArrows, Table2, Plus, Minus, Pencil, AlertTriangle } from 'lucide-react';
import { formatDate } from '@/lib/utils';

/**
 * Schema Evolution Timeline — shows how the database schema has changed
 * over time through schema snapshots captured after validations.
 */
export function SchemaTimelinePage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [snapshots, setSnapshots] = useState<SchemaSnapshotSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Diff between two selected snapshots
  const [selectedDiff, setSelectedDiff] = useState<{
    beforeId: string;
    afterId: string;
    diff: SchemaDiff;
  } | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    api
      .listSchemaSnapshots(projectId)
      .then((s) => {
        // Sort newest first
        const sorted = s.sort(
          (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
        );
        setSnapshots(sorted);
        if (sorted.length === 0) {
          setError('No schema snapshots found. Run a successful validation first.');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleCompare = async (beforeId: string, afterId: string) => {
    setDiffLoading(true);
    try {
      const diff = await api.compareSchemaSnapshots(beforeId, afterId);
      setSelectedDiff({ beforeId, afterId, diff });
    } catch (err: any) {
      toast({ title: 'Comparison failed', description: err.message, variant: 'destructive' });
    } finally {
      setDiffLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

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
          <Clock className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Schema Evolution Timeline</h1>
          <span className="text-sm text-muted-foreground">
            {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {error || snapshots.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-border py-16">
          <div className="text-center">
            <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-medium text-foreground">No Snapshots Available</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {error || 'Run validations to capture schema snapshots.'}
            </p>
            <Button asChild className="mt-4" variant="outline">
              <Link to={`/projects/${projectId}/validate`}>Go to Validation</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Timeline */}
          <div className="w-1/3">
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

              {snapshots.map((snap, i) => {
                const isFirst = i === 0;
                const prevSnap = snapshots[i + 1]; // older snapshot
                const isSelectedBefore = selectedDiff?.beforeId === snap.id;
                const isSelectedAfter = selectedDiff?.afterId === snap.id;
                const isSelected = isSelectedBefore || isSelectedAfter;

                return (
                  <div key={snap.id} className="relative mb-6 pl-10">
                    {/* Dot */}
                    <div
                      className={`absolute left-2.5 top-1.5 h-3 w-3 rounded-full border-2 ${
                        isSelected
                          ? 'border-primary bg-primary'
                          : isFirst
                            ? 'border-primary bg-background'
                            : 'border-muted-foreground bg-background'
                      }`}
                    />

                    <div
                      className={`rounded-lg border p-3 transition-colors ${
                        isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            {formatDate(snap.capturedAt)}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Table2 className="h-3 w-3" />
                            {snap.tableCount} table{snap.tableCount !== 1 ? 's' : ''}
                          </div>
                        </div>

                        {prevSnap && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCompare(prevSnap.id, snap.id)}
                            disabled={diffLoading}
                            className="text-xs"
                          >
                            <GitCompareArrows className="mr-1 h-3 w-3" />
                            Diff
                          </Button>
                        )}
                      </div>

                      {isFirst && (
                        <div className="mt-2 text-xs text-primary font-medium">Latest</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Diff panel */}
          <div className="flex-1">
            {diffLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : selectedDiff ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Schema Changes</h3>

                {/* Summary badges */}
                <div className="flex gap-3">
                  {selectedDiff.diff.addedTables.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <Plus className="h-3 w-3" />
                      {selectedDiff.diff.addedTables.length} added
                    </span>
                  )}
                  {selectedDiff.diff.removedTables.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      <Minus className="h-3 w-3" />
                      {selectedDiff.diff.removedTables.length} removed
                    </span>
                  )}
                  {selectedDiff.diff.modifiedTables.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      <Pencil className="h-3 w-3" />
                      {selectedDiff.diff.modifiedTables.length} modified
                    </span>
                  )}
                </div>

                {/* Added tables */}
                {selectedDiff.diff.addedTables.map((t) => (
                  <div key={t.name} className="rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-t-lg">
                      <Plus className="h-4 w-4 text-emerald-600" />
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">{t.name}</span>
                      <span className="text-xs text-emerald-600/70">{t.columns.length} columns</span>
                    </div>
                    <div className="px-4 py-2 text-sm">
                      {t.columns.map((c) => (
                        <div key={c.name} className="flex items-center gap-2 py-0.5 text-xs">
                          <span className="font-mono text-foreground">{c.name}</span>
                          <span className="text-muted-foreground">{c.dataType}</span>
                          {c.isPrimaryKey && <span className="text-amber-500 text-[10px] font-bold">PK</span>}
                          {!c.isNullable && <span className="text-red-400 text-[10px] font-bold">NN</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Removed tables */}
                {selectedDiff.diff.removedTables.map((t) => (
                  <div key={t.name} className="rounded-lg border border-red-200 dark:border-red-800">
                    <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg">
                      <Minus className="h-4 w-4 text-red-600" />
                      <span className="font-medium text-red-700 dark:text-red-400">{t.name}</span>
                      <span className="text-xs text-red-600/70">{t.columns.length} columns removed</span>
                    </div>
                  </div>
                ))}

                {/* Modified tables */}
                {selectedDiff.diff.modifiedTables.map((t) => (
                  <div key={t.tableName} className="rounded-lg border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 rounded-t-lg">
                      <Pencil className="h-4 w-4 text-amber-600" />
                      <span className="font-medium text-amber-700 dark:text-amber-400">{t.tableName}</span>
                    </div>
                    <div className="px-4 py-2 text-sm space-y-1">
                      {t.addedColumns.map((c) => (
                        <div key={c.name} className="flex items-center gap-2 text-xs text-emerald-600">
                          <Plus className="h-3 w-3" />
                          <span className="font-mono">{c.name}</span>
                          <span>{c.dataType}</span>
                        </div>
                      ))}
                      {t.removedColumns.map((c) => (
                        <div key={c.name} className="flex items-center gap-2 text-xs text-red-600">
                          <Minus className="h-3 w-3" />
                          <span className="font-mono">{c.name}</span>
                          <span>{c.dataType}</span>
                        </div>
                      ))}
                      {t.modifiedColumns.map((c) => (
                        <div key={c.columnName} className="flex items-center gap-2 text-xs text-amber-600">
                          <Pencil className="h-3 w-3" />
                          <span className="font-mono">{c.columnName}</span>
                          <span>{c.before.dataType} → {c.after.dataType}</span>
                          {c.before.isNullable !== c.after.isNullable && (
                            <span>{c.after.isNullable ? '→ nullable' : '→ NOT NULL'}</span>
                          )}
                        </div>
                      ))}
                      {t.addedForeignKeys.map((fk) => (
                        <div key={fk.constraintName} className="flex items-center gap-2 text-xs text-blue-600">
                          <Plus className="h-3 w-3" />
                          <span>FK {fk.columnName} → {fk.referencedTable}.{fk.referencedColumn}</span>
                        </div>
                      ))}
                      {t.removedForeignKeys.map((fk) => (
                        <div key={fk.constraintName} className="flex items-center gap-2 text-xs text-red-600">
                          <Minus className="h-3 w-3" />
                          <span>FK {fk.constraintName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {selectedDiff.diff.addedTables.length === 0 &&
                  selectedDiff.diff.removedTables.length === 0 &&
                  selectedDiff.diff.modifiedTables.length === 0 && (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      No schema changes detected between these snapshots.
                    </div>
                  )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 rounded-lg border-2 border-dashed text-sm text-muted-foreground">
                Click "Diff" on a snapshot to see changes from the previous version
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
