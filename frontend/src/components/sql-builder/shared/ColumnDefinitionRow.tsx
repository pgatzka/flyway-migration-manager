import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { TypeSelect } from './TypeSelect';
import { X } from 'lucide-react';
import type { ColumnDef } from '@/lib/sql-generators';

interface ColumnDefinitionRowProps {
  column: ColumnDef;
  onChange: (column: ColumnDef) => void;
  onRemove: () => void;
}

/**
 * A single row in the column definition list for CreateTable.
 * Contains: name, type, nullable, default, primary key, remove button.
 */
export function ColumnDefinitionRow({ column, onChange, onRemove }: ColumnDefinitionRowProps) {
  return (
    <div className="flex items-start gap-2 rounded-md border bg-card p-2">
      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="column_name"
            value={column.name}
            onChange={(e) => onChange({ ...column, name: e.target.value })}
            className="h-8 text-xs"
          />
          <div className="w-40">
            <TypeSelect
              value={column.type}
              onChange={(type) => onChange({ ...column, type })}
              label=""
            />
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-1.5">
            <Checkbox
              checked={!column.nullable}
              onCheckedChange={(c) => onChange({ ...column, nullable: !c })}
            />
            NOT NULL
          </label>
          <label className="flex items-center gap-1.5">
            <Checkbox
              checked={column.isPrimaryKey}
              onCheckedChange={(c) => onChange({ ...column, isPrimaryKey: !!c })}
            />
            PK
          </label>
          <Input
            placeholder="DEFAULT"
            value={column.defaultValue}
            onChange={(e) => onChange({ ...column, defaultValue: e.target.value })}
            className="h-6 flex-1 text-xs"
          />
        </div>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onRemove}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
