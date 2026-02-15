import { useState } from 'react';
import { Command } from 'cmdk';
import { Label } from '@/components/ui/label';
import { PG_TYPE_CATEGORIES } from '@/lib/pg-types';
import { cn } from '@/lib/utils';

interface TypeSelectProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

/**
 * Searchable PostgreSQL type combobox using cmdk.
 * Types are grouped by category (Numeric, Text, etc.).
 */
export function TypeSelect({ value, onChange, label = 'Type' }: TypeSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  return (
    <div className="relative space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          !value && "text-muted-foreground"
        )}
      >
        {value || 'Select type...'}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <Command className="w-full" shouldFilter>
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search types..."
              className="h-9 w-full border-b bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
            />
            <Command.List className="max-h-48 overflow-y-auto p-1">
              <Command.Empty className="py-4 text-center text-sm text-muted-foreground">
                No type found.
              </Command.Empty>
              {PG_TYPE_CATEGORIES.map((cat) => (
                <Command.Group key={cat.label} heading={cat.label}
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
                >
                  {cat.types.map((t) => (
                    <Command.Item
                      key={t.name}
                      value={t.name}
                      onSelect={() => {
                        onChange(t.name);
                        setOpen(false);
                        setSearch('');
                      }}
                      className="flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm aria-selected:bg-accent aria-selected:text-accent-foreground"
                    >
                      {t.name}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </div>
      )}
    </div>
  );
}
