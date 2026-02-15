import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { generateDropView, type DropViewConfig } from '@/lib/sql-generators';

interface Props {
  onSqlChange: (sql: string) => void;
}

export function DropViewBuilder({ onSqlChange }: Props) {
  const [cfg, setCfg] = useState<DropViewConfig>({
    viewName: '',
    ifExists: true,
    cascade: false,
  });

  useEffect(() => {
    onSqlChange(generateDropView(cfg));
  }, [cfg, onSqlChange]);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">View Name</Label>
        <Input placeholder="my_view" value={cfg.viewName} onChange={(e) => setCfg({ ...cfg, viewName: e.target.value })} />
      </div>
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
