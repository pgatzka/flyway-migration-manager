import type { SchemaSnapshot } from '@shared/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TableSelectProps {
  schema: SchemaSnapshot | null;
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

/**
 * Schema-aware table dropdown.
 * Falls back to a free-text Input when no schema is available.
 */
export function TableSelect({ schema, value, onChange, label = 'Table' }: TableSelectProps) {
  const tables = schema?.tables ?? [];

  if (tables.length === 0) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{label}</Label>
        <Input
          placeholder="table_name"
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
          <SelectValue placeholder="Select table..." />
        </SelectTrigger>
        <SelectContent>
          {tables.map((t) => (
            <SelectItem key={t.name} value={t.name}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
