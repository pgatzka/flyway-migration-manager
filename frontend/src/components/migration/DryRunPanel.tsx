import { useMemo } from 'react';
import { analyzeDryRun, type DryRunReport } from '@/lib/dry-run-analyzer';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table2,
  Plus,
  Minus,
  Pencil,
  Hash,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowRight,
} from 'lucide-react';

interface DryRunPanelProps {
  sqlContent: string;
}

const riskColors: Record<string, string> = {
  low: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
  medium: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
  high: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
  critical: 'text-red-600 bg-red-50 dark:bg-red-900/20',
};

const typeIcons: Record<string, typeof Plus> = {
  'CREATE TABLE': Plus,
  'DROP TABLE': Minus,
  'ALTER TABLE': Pencil,
  'CREATE INDEX': Plus,
  'DROP INDEX': Minus,
  'CREATE VIEW': Plus,
  'DROP VIEW': Minus,
  'CREATE TYPE': Plus,
  'INSERT': ArrowRight,
  'UPDATE': Pencil,
  'DELETE': Minus,
  'OTHER': Hash,
};

const typeColors: Record<string, string> = {
  'CREATE TABLE': 'text-emerald-500',
  'DROP TABLE': 'text-red-500',
  'ALTER TABLE': 'text-amber-500',
  'CREATE INDEX': 'text-blue-500',
  'DROP INDEX': 'text-red-500',
  'CREATE VIEW': 'text-blue-500',
  'DROP VIEW': 'text-red-500',
  'CREATE TYPE': 'text-purple-500',
  'INSERT': 'text-blue-500',
  'UPDATE': 'text-amber-500',
  'DELETE': 'text-red-500',
  'OTHER': 'text-muted-foreground',
};

/**
 * Displays a dry-run analysis of SQL migration content.
 * Shows what operations would be performed without executing them.
 */
export function DryRunPanel({ sqlContent }: DryRunPanelProps) {
  const report: DryRunReport = useMemo(() => analyzeDryRun(sqlContent), [sqlContent]);

  if (report.operations.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No SQL operations detected. Write some SQL to see the dry run preview.
      </div>
    );
  }

  return (
    <div className="border rounded-lg bg-card">
      {/* Summary */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Dry Run Preview</span>
          <span className="text-xs text-muted-foreground">
            {report.operations.length} operation{report.operations.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${riskColors[report.estimatedRisk]}`}>
          <AlertTriangle className="h-3 w-3" />
          {report.estimatedRisk.toUpperCase()} risk
        </span>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 border-b px-4 py-2 text-xs text-muted-foreground">
        {report.tablesCreated.length > 0 && (
          <span className="flex items-center gap-1 text-emerald-600">
            <Plus className="h-3 w-3" /> {report.tablesCreated.length} table{report.tablesCreated.length > 1 ? 's' : ''} created
          </span>
        )}
        {report.tablesDropped.length > 0 && (
          <span className="flex items-center gap-1 text-red-600">
            <Minus className="h-3 w-3" /> {report.tablesDropped.length} table{report.tablesDropped.length > 1 ? 's' : ''} dropped
          </span>
        )}
        {report.tablesModified.length > 0 && (
          <span className="flex items-center gap-1 text-amber-600">
            <Pencil className="h-3 w-3" /> {report.tablesModified.length} table{report.tablesModified.length > 1 ? 's' : ''} modified
          </span>
        )}
        {report.dataModifications > 0 && (
          <span className="flex items-center gap-1 text-blue-600">
            <Table2 className="h-3 w-3" /> {report.dataModifications} data op{report.dataModifications > 1 ? 's' : ''}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {report.isFullyReversible ? (
            <><CheckCircle className="h-3 w-3 text-emerald-500" /> Fully reversible</>
          ) : (
            <><XCircle className="h-3 w-3 text-amber-500" /> Contains irreversible ops</>
          )}
        </span>
      </div>

      {/* Operations list */}
      <ScrollArea className="max-h-[200px]">
        <div className="divide-y divide-border/50">
          {report.operations.map((op, i) => {
            const Icon = typeIcons[op.type] || Hash;
            const color = typeColors[op.type] || 'text-muted-foreground';
            return (
              <div key={i} className="flex items-center gap-2 px-4 py-1.5 text-xs">
                <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} />
                <span className={`font-mono text-[10px] w-24 shrink-0 ${color}`}>{op.type}</span>
                <span className="text-foreground flex-1 truncate">{op.detail}</span>
                <span className="font-mono text-muted-foreground text-[10px]">L{op.line}</span>
                {!op.reversible && (
                  <span className="text-[10px] text-red-400 font-bold">!</span>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
