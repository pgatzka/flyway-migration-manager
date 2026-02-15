import { useState, useEffect } from 'react';
import type { SchemaSnapshot } from '@shared/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TableSelect } from '../shared/TableSelect';
import { ColumnSelect } from '../shared/ColumnSelect';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { generateAddForeignKey, type AddForeignKeyConfig } from '@/lib/sql-generators';

const FK_ACTIONS = ['NO ACTION', 'CASCADE', 'SET NULL', 'SET DEFAULT', 'RESTRICT'];

interface Props {
  schema: SchemaSnapshot | null;
  onSqlChange: (sql: string) => void;
}

export function AddForeignKeyBuilder({ schema, onSqlChange }: Props) {
  const [cfg, setCfg] = useState<AddForeignKeyConfig>({
    tableName: '',
    columnName: '',
    referencedTable: '',
    referencedColumn: '',
    constraintName: '',
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  });

  useEffect(() => {
    onSqlChange(generateAddForeignKey(cfg));
  }, [cfg, onSqlChange]);

  const autoName = cfg.tableName && cfg.columnName
    ? `fk_${cfg.tableName}_${cfg.columnName}`
    : '';

  return (
    <div className="space-y-3">
      <TableSelect schema={schema} value={cfg.tableName} onChange={(v) => setCfg({ ...cfg, tableName: v, columnName: '' })} label="Source Table" />
      <ColumnSelect schema={schema} tableName={cfg.tableName} value={cfg.columnName} onChange={(v) => setCfg({ ...cfg, columnName: v })} label="Source Column" />
      <TableSelect schema={schema} value={cfg.referencedTable} onChange={(v) => setCfg({ ...cfg, referencedTable: v, referencedColumn: '' })} label="Referenced Table" />
      <ColumnSelect schema={schema} tableName={cfg.referencedTable} value={cfg.referencedColumn} onChange={(v) => setCfg({ ...cfg, referencedColumn: v })} label="Referenced Column" />
      <div className="space-y-1.5">
        <Label className="text-xs">Constraint Name</Label>
        <Input placeholder={autoName || 'fk_table_column'} value={cfg.constraintName} onChange={(e) => setCfg({ ...cfg, constraintName: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">ON DELETE</Label>
          <Select value={cfg.onDelete} onValueChange={(v) => setCfg({ ...cfg, onDelete: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FK_ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">ON UPDATE</Label>
          <Select value={cfg.onUpdate} onValueChange={(v) => setCfg({ ...cfg, onUpdate: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FK_ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
