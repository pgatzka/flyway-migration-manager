import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DependencyGraphView } from '@/components/dependency-graph/DependencyGraph';
import { buildDependencyGraph, type DependencyGraph } from '@/lib/migration-graph';
import * as api from '@/api/client';
import type { Migration } from '@shared/types';
import { ArrowLeft, GitBranch, AlertTriangle, Table2 } from 'lucide-react';

/**
 * Page that displays an interactive dependency graph of project migrations.
 * Shows how migrations relate to each other through shared table operations.
 */
export function DependencyGraphPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [migrations, setMigrations] = useState<Migration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    api
      .listMigrations(projectId)
      .then((m) => {
        setMigrations(m);
        if (m.length === 0) {
          setError('No migrations found. Create some migrations first.');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  const graph: DependencyGraph | null = useMemo(() => {
    if (migrations.length === 0) return null;
    return buildDependencyGraph(migrations);
  }, [migrations]);

  // Compute stats
  const stats = useMemo(() => {
    if (!graph) return null;
    const tables = new Set<string>();
    for (const node of graph.nodes) {
      for (const ref of node.tables) {
        tables.add(ref.table);
      }
    }
    return {
      migrations: graph.nodes.length,
      dependencies: graph.edges.length,
      tables: tables.size,
      destructive: graph.nodes.filter((n) => n.riskLevel === 'destructive').length,
    };
  }, [graph]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col space-y-4">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link to={`/projects/${projectId}`}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Project
          </Link>
        </Button>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitBranch className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Dependency Graph</h1>
          </div>

          {stats && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{stats.migrations} migration{stats.migrations !== 1 ? 's' : ''}</span>
              <span>{stats.dependencies} dependenc{stats.dependencies !== 1 ? 'ies' : 'y'}</span>
              <span className="flex items-center gap-1">
                <Table2 className="h-3.5 w-3.5" />
                {stats.tables} table{stats.tables !== 1 ? 's' : ''}
              </span>
              {stats.destructive > 0 && (
                <span className="flex items-center gap-1 text-red-500">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {stats.destructive} destructive
                </span>
              )}
            </div>
          )}
        </div>

        {/* Legend */}
        {graph && (
          <div className="mt-2 flex items-center gap-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Safe (CREATE)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              Caution (ALTER/WRITE)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              Destructive (DROP)
            </span>
            <span className="ml-4 border-l pl-4 flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-emerald-500" />
              Creates dependency
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-amber-500" />
              Modifies after
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 bg-red-500 border-dashed" />
              Drops created
            </span>
          </div>
        )}
      </div>

      {/* Graph content */}
      {error || !graph ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-border">
          <div className="text-center">
            <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-medium text-foreground">No Migrations Available</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {error || 'Create migrations to see their dependency graph.'}
            </p>
            <Button asChild className="mt-4" variant="outline">
              <Link to={`/projects/${projectId}`}>Go to Project</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden rounded-lg border">
          <DependencyGraphView graph={graph} />
        </div>
      )}
    </div>
  );
}
