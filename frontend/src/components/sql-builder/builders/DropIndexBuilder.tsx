import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { generateDropIndex, type DropIndexConfig } from '@/lib/sql-generators';

interface Props {
  onSqlChange: (sql: string) => void;
}

export function DropIndexBuilder({ onSqlChange }: Props) {
  const [cfg, setCfg] = useState<DropIndexConfig>({
    indexName: '',
    ifExists: true,
    concurrently: false,
  });

  useEffect(() => {
    onSqlChange(generateDropIndex(cfg));
  }, [cfg, onSqlChange]);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Index Name</Label>
        <Input placeholder="idx_table_column" value={cfg.indexName} onChange={(e) => setCfg({ ...cfg, indexName: e.target.value })} />
      </div>
      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <Checkbox checked={cfg.ifExists} onCheckedChange={(c) => setCfg({ ...cfg, ifExists: !!c })} />
          IF EXISTS
        </label>
        <label className="flex items-center gap-1.5">
          <Checkbox checked={cfg.concurrently} onCheckedChange={(c) => setCfg({ ...cfg, concurrently: !!c })} />
          CONCURRENTLY
        </label>
      </div>
    </div>
  );
}
