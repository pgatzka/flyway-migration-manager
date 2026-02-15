import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { ColumnDefinitionRow } from '../shared/ColumnDefinitionRow';
import { Plus, Zap } from 'lucide-react';
import { generateCreateTable, type CreateTableConfig, type ColumnDef } from '@/lib/sql-generators';

interface Props {
  onSqlChange: (sql: string) => void;
}

const emptyColumn = (): ColumnDef => ({
  name: '',
  type: '',
  nullable: true,
  defaultValue: '',
  isPrimaryKey: false,
});

const standardColumns = (): ColumnDef[] => [
  { name: 'id', type: 'UUID', nullable: false, defaultValue: 'gen_random_uuid()', isPrimaryKey: true },
  { name: 'created_at', type: 'TIMESTAMP WITH TIME ZONE', nullable: false, defaultValue: 'NOW()', isPrimaryKey: false },
  { name: 'updated_at', type: 'TIMESTAMP WITH TIME ZONE', nullable: false, defaultValue: 'NOW()', isPrimaryKey: false },
];

export function CreateTableBuilder({ onSqlChange }: Props) {
  const [cfg, setCfg] = useState<CreateTableConfig>({
    tableName: '',
    ifNotExists: true,
    columns: [emptyColumn()],
  });

  useEffect(() => {
    onSqlChange(generateCreateTable(cfg));
  }, [cfg, onSqlChange]);

  const updateColumn = (index: number, col: ColumnDef) => {
    const columns = [...cfg.columns];
    columns[index] = col;
    setCfg({ ...cfg, columns });
  };

  const removeColumn = (index: number) => {
    setCfg({ ...cfg, columns: cfg.columns.filter((_, i) => i !== index) });
  };

  const addColumn = () => {
    setCfg({ ...cfg, columns: [...cfg.columns, emptyColumn()] });
  };

  const addStandardColumns = () => {
    setCfg({ ...cfg, columns: [...standardColumns(), ...cfg.columns.filter((c) => c.name)] });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Table Name</Label>
        <Input placeholder="table_name" value={cfg.tableName} onChange={(e) => setCfg({ ...cfg, tableName: e.target.value })} />
      </div>
      <label className="flex items-center gap-1.5 text-sm">
        <Checkbox checked={cfg.ifNotExists} onCheckedChange={(c) => setCfg({ ...cfg, ifNotExists: !!c })} />
        IF NOT EXISTS
      </label>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Columns</Label>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addStandardColumns}>
            <Zap className="mr-1 h-3 w-3" />
            Standard (id, timestamps)
          </Button>
        </div>
        <div className="space-y-2">
          {cfg.columns.map((col, i) => (
            <ColumnDefinitionRow
              key={i}
              column={col}
              onChange={(c) => updateColumn(i, c)}
              onRemove={() => removeColumn(i)}
            />
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={addColumn}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add Column
        </Button>
      </div>
    </div>
  );
}
