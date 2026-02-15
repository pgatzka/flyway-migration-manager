import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ValidationProgress } from '@/components/validation/ValidationProgress';
import { ValidationLog } from '@/components/validation/ValidationLog';
import * as api from '@/api/client';
import type { ValidationProgressEvent, ValidationCompleteEvent, ValidationResult } from '@shared/types';
import { ArrowLeft, Play, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

type ValidationState = 'idle' | 'running' | 'done';

/**
 * Validation page that runs migrations against a temporary database
 * and shows real-time progress via SSE streaming.
 */
export function ValidationPage() {
  const { id: projectId } = useParams<{ id: string }>();

  const [state, setState] = useState<ValidationState>('idle');
  const [migrationEvents, setMigrationEvents] = useState<ValidationProgressEvent[]>([]);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [result, setResult] = useState<{ status: 'pass' | 'fail'; id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pastValidations, setPastValidations] = useState<ValidationResult[]>([]);
  const [pastLoading, setPastLoading] = useState(true);
  const controllerRef = useRef<AbortController | null>(null);

  // Load past validations on mount
  useEffect(() => {
    if (!projectId) return;
    api
      .listValidations(projectId)
      .then(setPastValidations)
      .catch(() => {})
      .finally(() => setPastLoading(false));
  }, [projectId]);

  const startValidation = () => {
    if (!projectId) return;

    setState('running');
    setMigrationEvents([]);
    setLogLines([]);
    setResult(null);
    setError(null);

    const controller = api.startValidation(
      projectId,
      (event) => {
        // Check if it's a completion event
        if ('done' in event && event.done) {
          const completeEvent = event as ValidationCompleteEvent;
          setState('done');
          setResult({
            status: completeEvent.overallStatus,
            id: completeEvent.validationResultId,
          });
          setLogLines((prev) => [
            ...prev,
            '',
            `Validation ${completeEvent.overallStatus === 'pass' ? 'PASSED' : 'FAILED'}`,
          ]);

          // Refresh past validations
          api.listValidations(projectId).then(setPastValidations).catch(() => {});
          return;
        }

        // It's a progress event
        const progressEvent = event as ValidationProgressEvent;
        setMigrationEvents((prev) => {
          const existing = prev.findIndex((e) => e.migrationId === progressEvent.migrationId);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = progressEvent;
            return updated;
          }
          return [...prev, progressEvent];
        });

        // Add log line for status changes
        if (progressEvent.status === 'running') {
          setLogLines((prev) => [
            ...prev,
            `Running V${progressEvent.version}__${progressEvent.description}...`,
          ]);
        } else if (progressEvent.status === 'pass') {
          setLogLines((prev) => [...prev, `  ✓ V${progressEvent.version} passed`]);
        } else if (progressEvent.status === 'fail') {
          setLogLines((prev) => [
            ...prev,
            `  ✗ V${progressEvent.version} FAILED: ${progressEvent.error || 'Unknown error'}`,
          ]);
        }
      },
      (errorMsg) => {
        setState('done');
        setError(errorMsg);
        setLogLines((prev) => [...prev, `ERROR: ${errorMsg}`]);
      }
    );

    controllerRef.current = controller;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

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

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Validation</h1>
          <Button
            onClick={startValidation}
            disabled={state === 'running'}
          >
            {state === 'running' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                {state === 'done' ? 'Run Again' : 'Start Validation'}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Result banner */}
      {result && (
        <div
          className={`flex items-center gap-3 rounded-lg p-4 ${
            result.status === 'pass'
              ? 'border border-green-200 bg-green-50 text-green-800'
              : 'border border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {result.status === 'pass' ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <XCircle className="h-5 w-5" />
          )}
          <span className="font-medium">
            Validation {result.status === 'pass' ? 'passed' : 'failed'}
          </span>
        </div>
      )}

      {error && !result && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}

      {/* Migration progress */}
      {migrationEvents.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-foreground">Migration Status</h2>
          <ValidationProgress events={migrationEvents} />
        </div>
      )}

      {/* Log output */}
      {logLines.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-foreground">Log Output</h2>
          <ValidationLog lines={logLines} />
        </div>
      )}

      {/* Idle state prompt */}
      {state === 'idle' && migrationEvents.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-border py-12 text-center">
          <Play className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-medium text-foreground">Ready to validate</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Click "Start Validation" to run all migrations against a temporary database.
          </p>
        </div>
      )}

      <Separator />

      {/* Past validations */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Validation History</h2>
        {pastLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : pastValidations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No validations have been run yet.</p>
        ) : (
          <div className="space-y-2">
            {pastValidations.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-3">
                  <Badge
                    variant={v.status === 'pass' ? 'success' : 'destructive'}
                  >
                    {v.status === 'pass' ? (
                      <CheckCircle className="mr-1 h-3 w-3" />
                    ) : (
                      <XCircle className="mr-1 h-3 w-3" />
                    )}
                    {v.status.toUpperCase()}
                  </Badge>
                  {v.errorMessage && (
                    <span className="max-w-md truncate text-muted-foreground" title={v.errorMessage}>
                      {v.errorMessage}
                    </span>
                  )}
                </div>
                <span className="text-muted-foreground">{formatDate(v.executedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
