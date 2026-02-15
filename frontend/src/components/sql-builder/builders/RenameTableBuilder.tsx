import { useState, useEffect } from 'react';
import type { SchemaSnapshot } from '@shared/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TableSelect } from '../shared/TableSelect';
import { generateRenameTable, type RenameTableConfig } from '@/lib/sql-generators';

interface Props {
  schema: SchemaSnapshot | null;
  onSqlChange: (sql: string) => void;
}

export function RenameTableBuilder({ schema, onSqlChange }: Props) {
  const [cfg, setCfg] = useState<RenameTableConfig>({ oldName: '', newName: '' });

  useEffect(() => {
    onSqlChange(generateRenameTable(cfg));
  }, [cfg, onSqlChange]);

  return (
    <div className="space-y-3">
      <TableSelect schema={schema} value={cfg.oldName} onChange={(v) => setCfg({ ...cfg, oldName: v })} label="Current Name" />
      <div className="space-y-1.5">
        <Label className="text-xs">New Name</Label>
        <Input placeholder="new_table_name" value={cfg.newName} onChange={(e) => setCfg({ ...cfg, newName: e.target.value })} />
      </div>
    </div>
  );
}
