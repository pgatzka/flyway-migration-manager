import { useState, useEffect } from 'react';
import type { SchemaSnapshot } from '@shared/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TableSelect } from '../shared/TableSelect';
import { generateDropConstraint, type DropConstraintConfig } from '@/lib/sql-generators';

interface Props {
  schema: SchemaSnapshot | null;
  onSqlChange: (sql: string) => void;
}

export function DropConstraintBuilder({ schema, onSqlChange }: Props) {
  const [cfg, setCfg] = useState<DropConstraintConfig>({
    tableName: '',
    constraintName: '',
  });

  useEffect(() => {
    onSqlChange(generateDropConstraint(cfg));
  }, [cfg, onSqlChange]);

  return (
    <div className="space-y-3">
      <TableSelect schema={schema} value={cfg.tableName} onChange={(v) => setCfg({ ...cfg, tableName: v })} />
      <div className="space-y-1.5">
        <Label className="text-xs">Constraint Name</Label>
        <Input placeholder="constraint_name" value={cfg.constraintName} onChange={(e) => setCfg({ ...cfg, constraintName: e.target.value })} />
      </div>
    </div>
  );
}
