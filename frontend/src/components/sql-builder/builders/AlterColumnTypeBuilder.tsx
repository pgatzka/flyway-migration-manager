import { useState, useEffect } from 'react';
import type { SchemaSnapshot } from '@shared/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TableSelect } from '../shared/TableSelect';
import { ColumnSelect } from '../shared/ColumnSelect';
import { TypeSelect } from '../shared/TypeSelect';
import { generateAlterColumnType, type AlterColumnTypeConfig } from '@/lib/sql-generators';

interface Props {
  schema: SchemaSnapshot | null;
  onSqlChange: (sql: string) => void;
}

export function AlterColumnTypeBuilder({ schema, onSqlChange }: Props) {
  const [cfg, setCfg] = useState<AlterColumnTypeConfig>({
    tableName: '',
    columnName: '',
    newType: '',
    usingExpression: '',
  });

  useEffect(() => {
    onSqlChange(generateAlterColumnType(cfg));
  }, [cfg, onSqlChange]);

  // Show current type hint
  const table = schema?.tables.find((t) => t.name === cfg.tableName);
  const col = table?.columns.find((c) => c.name === cfg.columnName);

  return (
    <div className="space-y-3">
      <TableSelect schema={schema} value={cfg.tableName} onChange={(v) => setCfg({ ...cfg, tableName: v, columnName: '' })} />
      <ColumnSelect schema={schema} tableName={cfg.tableName} value={cfg.columnName} onChange={(v) => setCfg({ ...cfg, columnName: v })} />
      {col && (
        <p className="text-xs text-muted-foreground">Current type: <code className="rounded bg-muted px-1">{col.dataType}</code></p>
      )}
      <TypeSelect value={cfg.newType} onChange={(v) => setCfg({ ...cfg, newType: v })} label="New Type" />
      <div className="space-y-1.5">
        <Label className="text-xs">USING Expression (optional)</Label>
        <Input placeholder="e.g. column_name::INTEGER" value={cfg.usingExpression} onChange={(e) => setCfg({ ...cfg, usingExpression: e.target.value })} />
      </div>
    </div>
  );
}
