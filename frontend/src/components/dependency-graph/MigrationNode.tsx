import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { FileCode, AlertTriangle, Trash2, Plus } from 'lucide-react';
import type { TableRef } from '@/lib/migration-graph';

export interface MigrationNodeData {
  label: string;
  version: number;
  description: string;
  tables: TableRef[];
  riskLevel: 'safe' | 'caution' | 'destructive';
  [key: string]: unknown;
}

const riskStyles = {
  safe: 'border-emerald-500/50 bg-emerald-500/5',
  caution: 'border-amber-500/50 bg-amber-500/5',
  destructive: 'border-red-500/50 bg-red-500/5',
} as const;

const riskHeaderStyles = {
  safe: 'bg-emerald-600 text-white',
  caution: 'bg-amber-600 text-white',
  destructive: 'bg-red-600 text-white',
} as const;

const actionIcons: Record<TableRef['action'], typeof Plus> = {
  create: Plus,
  alter: FileCode,
  drop: Trash2,
  read: FileCode,
  write: FileCode,
};

const actionLabels: Record<TableRef['action'], string> = {
  create: 'CREATE',
  alter: 'ALTER',
  drop: 'DROP',
  read: 'REF',
  write: 'WRITE',
};

const actionColors: Record<TableRef['action'], string> = {
  create: 'text-emerald-500',
  alter: 'text-amber-500',
  drop: 'text-red-500',
  read: 'text-blue-500',
  write: 'text-purple-500',
};

/**
 * Custom React Flow node that renders a migration with its table references.
 */
export const MigrationNode = memo(({ data }: NodeProps) => {
  const { version, description, tables, riskLevel } = data as unknown as MigrationNodeData;

  return (
    <div className={`min-w-[200px] max-w-[260px] rounded-lg border-2 shadow-lg overflow-hidden ${riskStyles[riskLevel]}`}>
      {/* Header */}
      <div className={`px-3 py-2 ${riskHeaderStyles[riskLevel]}`}>
        <div className="flex items-center gap-2">
          {riskLevel === 'destructive' && <AlertTriangle className="h-3.5 w-3.5" />}
          <span className="text-sm font-bold">V{version}</span>
        </div>
        <div className="text-xs opacity-90 truncate mt-0.5">
          {description.replace(/_/g, ' ')}
        </div>
      </div>

      {/* Table references */}
      {tables.length > 0 && (
        <div className="divide-y divide-border/50 px-2 py-1">
          {tables.map((ref, i) => {
            const Icon = actionIcons[ref.action];
            return (
              <div key={`${ref.table}-${ref.action}-${i}`} className="flex items-center gap-1.5 py-1 text-xs">
                <Icon className={`h-3 w-3 shrink-0 ${actionColors[ref.action]}`} />
                <span className={`font-mono text-[10px] ${actionColors[ref.action]}`}>
                  {actionLabels[ref.action]}
                </span>
                <span className="font-medium text-foreground truncate">{ref.table}</span>
              </div>
            );
          })}
        </div>
      )}

      {tables.length === 0 && (
        <div className="px-3 py-2 text-xs text-muted-foreground italic">
          No table operations
        </div>
      )}

      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-none"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-none"
      />
    </div>
  );
});

MigrationNode.displayName = 'MigrationNode';
