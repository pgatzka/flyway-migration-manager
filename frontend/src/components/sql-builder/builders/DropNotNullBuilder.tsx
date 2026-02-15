import { useState, useEffect } from 'react';
import type { SchemaSnapshot } from '@shared/types';
import { TableSelect } from '../shared/TableSelect';
import { ColumnSelect } from '../shared/ColumnSelect';
import { generateDropNotNull, type DropNotNullConfig } from '@/lib/sql-generators';

interface Props {
  schema: SchemaSnapshot | null;
  onSqlChange: (sql: string) => void;
}

export function DropNotNullBuilder({ schema, onSqlChange }: Props) {
  const [cfg, setCfg] = useState<DropNotNullConfig>({
    tableName: '',
    columnName: '',
  });

  useEffect(() => {
    onSqlChange(generateDropNotNull(cfg));
  }, [cfg, onSqlChange]);

  return (
    <div className="space-y-3">
      <TableSelect schema={schema} value={cfg.tableName} onChange={(v) => setCfg({ ...cfg, tableName: v, columnName: '' })} />
      <ColumnSelect
        schema={schema}
        tableName={cfg.tableName}
        value={cfg.columnName}
        onChange={(v) => setCfg({ ...cfg, columnName: v })}
        filter={(col) => !col.isNullable}
        label="Column (non-nullable)"
      />
    </div>
  );
}
