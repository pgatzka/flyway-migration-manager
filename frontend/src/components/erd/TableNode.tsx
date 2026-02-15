import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { KeyRound, ArrowRight } from 'lucide-react';
import type { SchemaColumn, SchemaForeignKey } from '@shared/types';

export interface TableNodeData {
  label: string;
  columns: SchemaColumn[];
  foreignKeys: SchemaForeignKey[];
  [key: string]: unknown;
}

/**
 * Custom React Flow node that renders a database table with columns.
 * Shows primary keys, data types, nullability, and foreign key indicators.
 */
export const TableNode = memo(({ data }: NodeProps) => {
  const { label, columns, foreignKeys } = data as unknown as TableNodeData;
  const fkColumns = new Set(foreignKeys.map((fk: SchemaForeignKey) => fk.columnName));

  return (
    <div className="min-w-[220px] rounded-lg border border-border bg-card shadow-lg overflow-hidden">
      {/* Table header */}
      <div className="bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">
        {label}
      </div>

      {/* Columns */}
      <div className="divide-y divide-border">
        {columns.map((col: SchemaColumn) => (
          <div
            key={col.name}
            className="flex items-center gap-2 px-3 py-1.5 text-xs"
          >
            {col.isPrimaryKey && (
              <KeyRound className="h-3 w-3 shrink-0 text-amber-500" />
            )}
            {fkColumns.has(col.name) && !col.isPrimaryKey && (
              <ArrowRight className="h-3 w-3 shrink-0 text-blue-500" />
            )}
            {!col.isPrimaryKey && !fkColumns.has(col.name) && (
              <span className="w-3 shrink-0" />
            )}
            <span className="font-medium text-foreground">{col.name}</span>
            <span className="ml-auto font-mono text-muted-foreground">
              {col.dataType}
            </span>
            {!col.isNullable && (
              <span className="text-red-400 text-[10px] font-bold">NN</span>
            )}
          </div>
        ))}
      </div>

      {/* Handles for edges — one target on left, one source on right */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-blue-500 !border-none"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-blue-500 !border-none"
      />
    </div>
  );
});

TableNode.displayName = 'TableNode';
