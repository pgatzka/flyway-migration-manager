import { useState, useEffect } from 'react';
import type { SchemaSnapshot } from '@shared/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { TableSelect } from '../shared/TableSelect';
import { ColumnSelect } from '../shared/ColumnSelect';
import { generateCreateIndex, type CreateIndexConfig } from '@/lib/sql-generators';

interface Props {
  schema: SchemaSnapshot | null;
  onSqlChange: (sql: string) => void;
}

export function CreateIndexBuilder({ schema, onSqlChange }: Props) {
  const [cfg, setCfg] = useState<CreateIndexConfig>({
    tableName: '',
    columns: [],
    indexName: '',
    unique: false,
    concurrently: false,
    where: '',
  });

  useEffect(() => {
    onSqlChange(generateCreateIndex(cfg));
  }, [cfg, onSqlChange]);

  // Auto-generate index name
  const autoName = cfg.tableName && cfg.columns.length > 0
    ? `idx_${cfg.tableName}_${cfg.columns.join('_')}`
    : '';

  return (
    <div className="space-y-3">
      <TableSelect schema={schema} value={cfg.tableName} onChange={(v) => setCfg({ ...cfg, tableName: v, columns: [] })} />
      <ColumnSelect schema={schema} tableName={cfg.tableName} value={cfg.columns} onChange={(v) => setCfg({ ...cfg, columns: v })} label="Columns" multi />
      <div className="space-y-1.5">
        <Label className="text-xs">Index Name</Label>
        <Input placeholder={autoName || 'idx_table_column'} value={cfg.indexName} onChange={(e) => setCfg({ ...cfg, indexName: e.target.value })} />
        {autoName && !cfg.indexName && (
          <p className="text-xs text-muted-foreground">Auto: {autoName}</p>
        )}
      </div>
      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <Checkbox checked={cfg.unique} onCheckedChange={(c) => setCfg({ ...cfg, unique: !!c })} />
          UNIQUE
        </label>
        <label className="flex items-center gap-1.5">
          <Checkbox checked={cfg.concurrently} onCheckedChange={(c) => setCfg({ ...cfg, concurrently: !!c })} />
          CONCURRENTLY
        </label>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">WHERE (partial index)</Label>
        <Input placeholder="e.g. active = true" value={cfg.where} onChange={(e) => setCfg({ ...cfg, where: e.target.value })} />
      </div>
    </div>
  );
}
