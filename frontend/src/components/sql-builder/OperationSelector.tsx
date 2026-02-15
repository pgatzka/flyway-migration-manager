import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type SqlOperation =
  | 'create-table' | 'drop-table' | 'rename-table'
  | 'add-column' | 'drop-column' | 'rename-column' | 'alter-column-type'
  | 'add-foreign-key' | 'drop-constraint' | 'add-not-null' | 'drop-not-null'
  | 'create-index' | 'drop-index'
  | 'create-enum' | 'create-view' | 'drop-view';

interface OperationSelectorProps {
  value: SqlOperation | '';
  onChange: (value: SqlOperation) => void;
}

export function OperationSelector({ value, onChange }: OperationSelectorProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SqlOperation)}>
      <SelectTrigger>
        <SelectValue placeholder="Choose operation..." />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Tables</SelectLabel>
          <SelectItem value="create-table">Create Table</SelectItem>
          <SelectItem value="drop-table">Drop Table</SelectItem>
          <SelectItem value="rename-table">Rename Table</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Columns</SelectLabel>
          <SelectItem value="add-column">Add Column</SelectItem>
          <SelectItem value="drop-column">Drop Column</SelectItem>
          <SelectItem value="rename-column">Rename Column</SelectItem>
          <SelectItem value="alter-column-type">Alter Column Type</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Constraints</SelectLabel>
          <SelectItem value="add-foreign-key">Add Foreign Key</SelectItem>
          <SelectItem value="drop-constraint">Drop Constraint</SelectItem>
          <SelectItem value="add-not-null">Add NOT NULL</SelectItem>
          <SelectItem value="drop-not-null">Drop NOT NULL</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Indexes</SelectLabel>
          <SelectItem value="create-index">Create Index</SelectItem>
          <SelectItem value="drop-index">Drop Index</SelectItem>
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Types & Views</SelectLabel>
          <SelectItem value="create-enum">Create Enum</SelectItem>
          <SelectItem value="create-view">Create View</SelectItem>
          <SelectItem value="drop-view">Drop View</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
