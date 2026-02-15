import type { SchemaSnapshot, SchemaColumn } from '@shared/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ColumnSelectSingleProps {
  schema: SchemaSnapshot | null;
  tableName: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  /** Filter columns shown in dropdown */
  filter?: (col: SchemaColumn) => boolean;
  multi?: false;
}

interface ColumnSelectMultiProps {
  schema: SchemaSnapshot | null;
  tableName: string;
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  filter?: (col: SchemaColumn) => boolean;
  multi: true;
}

type ColumnSelectProps = ColumnSelectSingleProps | ColumnSelectMultiProps;

/**
 * Schema-aware column dropdown (single or multi mode).
 * Falls back to a free-text Input when no schema or table is selected.
 */
export function ColumnSelect(props: ColumnSelectProps) {
  const { schema, tableName, label = 'Column', filter } = props;
  const table = schema?.tables.find((t) => t.name === tableName);
  let columns = table?.columns ?? [];
  if (filter) columns = columns.filter(filter);

  // Multi-select mode — checkboxes
  if (props.multi) {
    const { value, onChange } = props;
    if (columns.length === 0) {
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{label}</Label>
          <Input
            placeholder="col1, col2"
            value={value.join(', ')}
            onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
          />
        </div>
      );
    }

    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{label}</Label>
        <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-2">
          {columns.map((col) => {
            const checked = value.includes(col.name);
            return (
              <label key={col.name} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(c) => {
                    if (c) onChange([...value, col.name]);
                    else onChange(value.filter((v) => v !== col.name));
                  }}
                />
                <span>{col.name}</span>
                <span className="text-xs text-muted-foreground">{col.dataType}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  // Single-select mode
  const { value, onChange } = props;

  if (columns.length === 0) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{label}</Label>
        <Input
          placeholder="column_name"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select column..." />
        </SelectTrigger>
        <SelectContent>
          {columns.map((col) => (
            <SelectItem key={col.name} value={col.name}>
              {col.name}
              <span className="ml-2 text-xs text-muted-foreground">{col.dataType}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
