import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { generateCreateView, type CreateViewConfig } from '@/lib/sql-generators';

interface Props {
  onSqlChange: (sql: string) => void;
}

export function CreateViewBuilder({ onSqlChange }: Props) {
  const [cfg, setCfg] = useState<CreateViewConfig>({
    viewName: '',
    orReplace: true,
    query: '',
  });

  useEffect(() => {
    onSqlChange(generateCreateView(cfg));
  }, [cfg, onSqlChange]);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">View Name</Label>
        <Input placeholder="my_view" value={cfg.viewName} onChange={(e) => setCfg({ ...cfg, viewName: e.target.value })} />
      </div>
      <label className="flex items-center gap-1.5 text-sm">
        <Checkbox checked={cfg.orReplace} onCheckedChange={(c) => setCfg({ ...cfg, orReplace: !!c })} />
        OR REPLACE
      </label>
      <div className="space-y-1.5">
        <Label className="text-xs">SQL Query</Label>
        <Textarea
          placeholder="SELECT ... FROM ..."
          value={cfg.query}
          onChange={(e) => setCfg({ ...cfg, query: e.target.value })}
          className="min-h-[100px] font-mono text-xs"
        />
      </div>
    </div>
  );
}
