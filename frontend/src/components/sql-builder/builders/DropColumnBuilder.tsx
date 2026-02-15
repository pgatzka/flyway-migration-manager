import { useState, useEffect } from 'react';
import type { SchemaSnapshot } from '@shared/types';
import { Checkbox } from '@/components/ui/checkbox';
import { TableSelect } from '../shared/TableSelect';
import { ColumnSelect } from '../shared/ColumnSelect';
import { generateDropColumn, type DropColumnConfig } from '@/lib/sql-generators';

interface Props {
  schema: SchemaSnapshot | null;
  onSqlChange: (sql: string) => void;
}

export function DropColumnBuilder({ schema, onSqlChange }: Props) {
  const [cfg, setCfg] = useState<DropColumnConfig>({
    tableName: '',
    columnName: '',
    ifExists: true,
  });

  useEffect(() => {
    onSqlChange(generateDropColumn(cfg));
  }, [cfg, onSqlChange]);

  return (
    <div className="space-y-3">
      <TableSelect schema={schema} value={cfg.tableName} onChange={(v) => setCfg({ ...cfg, tableName: v, columnName: '' })} />
      <ColumnSelect schema={schema} tableName={cfg.tableName} value={cfg.columnName} onChange={(v) => setCfg({ ...cfg, columnName: v })} />
      <label className="flex items-center gap-1.5 text-sm">
        <Checkbox checked={cfg.ifExists} onCheckedChange={(c) => setCfg({ ...cfg, ifExists: !!c })} />
        IF EXISTS
      </label>
    </div>
  );
}
