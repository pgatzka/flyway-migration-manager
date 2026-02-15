import { useState, useEffect } from 'react';
import type { SchemaSnapshot } from '@shared/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TableSelect } from '../shared/TableSelect';
import { ColumnSelect } from '../shared/ColumnSelect';
import { generateAddNotNull, type AddNotNullConfig } from '@/lib/sql-generators';

interface Props {
  schema: SchemaSnapshot | null;
  onSqlChange: (sql: string) => void;
}

export function AddNotNullBuilder({ schema, onSqlChange }: Props) {
  const [cfg, setCfg] = useState<AddNotNullConfig>({
    tableName: '',
    columnName: '',
    defaultValue: '',
  });

  useEffect(() => {
    onSqlChange(generateAddNotNull(cfg));
  }, [cfg, onSqlChange]);

  return (
    <div className="space-y-3">
      <TableSelect schema={schema} value={cfg.tableName} onChange={(v) => setCfg({ ...cfg, tableName: v, columnName: '' })} />
      <ColumnSelect
        schema={schema}
        tableName={cfg.tableName}
        value={cfg.columnName}
        onChange={(v) => setCfg({ ...cfg, columnName: v })}
        filter={(col) => col.isNullable}
        label="Column (nullable)"
      />
      <div className="space-y-1.5">
        <Label className="text-xs">Default for existing NULLs</Label>
        <Input placeholder="e.g. 0, '', NOW()" value={cfg.defaultValue} onChange={(e) => setCfg({ ...cfg, defaultValue: e.target.value })} />
        <p className="text-xs text-muted-foreground">If set, generates an UPDATE before the ALTER</p>
      </div>
    </div>
  );
}
