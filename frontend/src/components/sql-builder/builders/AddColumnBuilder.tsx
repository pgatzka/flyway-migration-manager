import { useState, useEffect } from 'react';
import type { SchemaSnapshot } from '@shared/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { TableSelect } from '../shared/TableSelect';
import { TypeSelect } from '../shared/TypeSelect';
import { generateAddColumn, type AddColumnConfig } from '@/lib/sql-generators';

interface Props {
  schema: SchemaSnapshot | null;
  onSqlChange: (sql: string) => void;
}

export function AddColumnBuilder({ schema, onSqlChange }: Props) {
  const [cfg, setCfg] = useState<AddColumnConfig>({
    tableName: '',
    columnName: '',
    type: '',
    nullable: true,
    defaultValue: '',
  });

  useEffect(() => {
    onSqlChange(generateAddColumn(cfg));
  }, [cfg, onSqlChange]);

  return (
    <div className="space-y-3">
      <TableSelect schema={schema} value={cfg.tableName} onChange={(v) => setCfg({ ...cfg, tableName: v })} />
      <div className="space-y-1.5">
        <Label className="text-xs">Column Name</Label>
        <Input placeholder="column_name" value={cfg.columnName} onChange={(e) => setCfg({ ...cfg, columnName: e.target.value })} />
      </div>
      <TypeSelect value={cfg.type} onChange={(v) => setCfg({ ...cfg, type: v })} />
      <label className="flex items-center gap-1.5 text-sm">
        <Checkbox checked={!cfg.nullable} onCheckedChange={(c) => setCfg({ ...cfg, nullable: !c })} />
        NOT NULL
      </label>
      <div className="space-y-1.5">
        <Label className="text-xs">Default</Label>
        <Input placeholder="e.g. 0, 'active', NOW()" value={cfg.defaultValue} onChange={(e) => setCfg({ ...cfg, defaultValue: e.target.value })} />
      </div>
    </div>
  );
}
