import { useState, useEffect } from 'react';
import type { SchemaSnapshot } from '@shared/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TableSelect } from '../shared/TableSelect';
import { ColumnSelect } from '../shared/ColumnSelect';
import { generateRenameColumn, type RenameColumnConfig } from '@/lib/sql-generators';

interface Props {
  schema: SchemaSnapshot | null;
  onSqlChange: (sql: string) => void;
}

export function RenameColumnBuilder({ schema, onSqlChange }: Props) {
  const [cfg, setCfg] = useState<RenameColumnConfig>({
    tableName: '',
    oldName: '',
    newName: '',
  });

  useEffect(() => {
    onSqlChange(generateRenameColumn(cfg));
  }, [cfg, onSqlChange]);

  return (
    <div className="space-y-3">
      <TableSelect schema={schema} value={cfg.tableName} onChange={(v) => setCfg({ ...cfg, tableName: v, oldName: '' })} />
      <ColumnSelect schema={schema} tableName={cfg.tableName} value={cfg.oldName} onChange={(v) => setCfg({ ...cfg, oldName: v })} label="Current Column" />
      <div className="space-y-1.5">
        <Label className="text-xs">New Name</Label>
        <Input placeholder="new_column_name" value={cfg.newName} onChange={(e) => setCfg({ ...cfg, newName: e.target.value })} />
      </div>
    </div>
  );
}
