import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SchemaERD } from '@/components/erd/SchemaERD';
import * as api from '@/api/client';
import type { SchemaSnapshot } from '@shared/types';
import { ArrowLeft, Database, AlertTriangle } from 'lucide-react';
import { formatDate } from '@/lib/utils';

/**
 * ERD page that displays an interactive entity-relationship diagram
 * based on the latest schema snapshot from a successful validation.
 */
export function ERDPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [snapshot, setSnapshot] = useState<SchemaSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    api
      .getSchemaSnapshot(projectId)
      .then((s) => {
        setSnapshot(s);
        if (!s) {
          setError('No schema snapshot found. Run a successful validation first.');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [projectId]);

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
            <Database className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Schema ERD</h1>
            {snapshot && (
              <span className="text-sm text-muted-foreground">
                {snapshot.tables.length} table{snapshot.tables.length !== 1 ? 's' : ''}
                {' \u00B7 '}
                Captured {formatDate(snapshot.capturedAt)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to={`/projects/${projectId}/validate`}>
                Run Validation
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ERD content */}
      {error || !snapshot ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-border">
          <div className="text-center">
            <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="text-lg font-medium text-foreground">No Schema Available</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {error || 'Run a successful validation to generate the ERD.'}
            </p>
            <Button asChild className="mt-4" variant="outline">
              <Link to={`/projects/${projectId}/validate`}>Go to Validation</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden rounded-lg border">
          <SchemaERD tables={snapshot.tables} />
        </div>
      )}
    </div>
  );
}
