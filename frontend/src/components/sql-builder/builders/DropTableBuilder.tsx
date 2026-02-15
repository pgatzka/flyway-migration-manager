import { useState, useEffect } from 'react';
import type { SchemaSnapshot } from '@shared/types';
import { Checkbox } from '@/components/ui/checkbox';
import { TableSelect } from '../shared/TableSelect';
import { generateDropTable, type DropTableConfig } from '@/lib/sql-generators';

interface Props {
  schema: SchemaSnapshot | null;
  onSqlChange: (sql: string) => void;
}

export function DropTableBuilder({ schema, onSqlChange }: Props) {
  const [cfg, setCfg] = useState<DropTableConfig>({
    tableName: '',
    ifExists: true,
    cascade: false,
  });

  useEffect(() => {
    onSqlChange(generateDropTable(cfg));
  }, [cfg, onSqlChange]);

  return (
    <div className="space-y-3">
      <TableSelect schema={schema} value={cfg.tableName} onChange={(v) => setCfg({ ...cfg, tableName: v })} />
      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <Checkbox checked={cfg.ifExists} onCheckedChange={(c) => setCfg({ ...cfg, ifExists: !!c })} />
          IF EXISTS
        </label>
        <label className="flex items-center gap-1.5">
          <Checkbox checked={cfg.cascade} onCheckedChange={(c) => setCfg({ ...cfg, cascade: !!c })} />
          CASCADE
        </label>
      </div>
    </div>
  );
}
