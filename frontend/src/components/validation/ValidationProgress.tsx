import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import type { ValidationProgressEvent } from '@shared/types';

interface ValidationProgressProps {
  events: ValidationProgressEvent[];
}

/**
 * Displays the real-time status of each migration during validation.
 * Shows pending/running/pass/fail state with icons.
 */
export function ValidationProgress({ events }: ValidationProgressProps) {
  if (events.length === 0) return null;

  return (
    <div className="space-y-1">
      {events.map((event) => (
        <div
          key={event.migrationId}
          className="flex items-center justify-between rounded px-3 py-2 text-sm bg-card border"
        >
          <span className="font-mono">
            V{event.version} — {event.description}
          </span>
          <StatusBadge status={event.status} error={event.error} />
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status, error }: { status: string; error?: string }) {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
    case 'running':
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Running
        </Badge>
      );
    case 'pass':
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle className="h-3 w-3" />
          Pass
        </Badge>
      );
    case 'fail':
      return (
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Fail
          </Badge>
          {error && (
            <span className="max-w-md truncate text-xs text-red-600" title={error}>
              {error}
            </span>
          )}
        </div>
      );
    default:
      return null;
  }
}
