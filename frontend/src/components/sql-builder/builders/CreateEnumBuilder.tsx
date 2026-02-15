import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { generateCreateEnum, type CreateEnumConfig } from '@/lib/sql-generators';

interface Props {
  onSqlChange: (sql: string) => void;
}

export function CreateEnumBuilder({ onSqlChange }: Props) {
  const [cfg, setCfg] = useState<CreateEnumConfig>({
    typeName: '',
    values: [''],
  });

  useEffect(() => {
    const cleaned = { ...cfg, values: cfg.values.filter(Boolean) };
    onSqlChange(generateCreateEnum(cleaned));
  }, [cfg, onSqlChange]);

  const updateValue = (index: number, value: string) => {
    const values = [...cfg.values];
    values[index] = value;
    setCfg({ ...cfg, values });
  };

  const addValue = () => {
    setCfg({ ...cfg, values: [...cfg.values, ''] });
  };

  const removeValue = (index: number) => {
    setCfg({ ...cfg, values: cfg.values.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Type Name</Label>
        <Input placeholder="status_type" value={cfg.typeName} onChange={(e) => setCfg({ ...cfg, typeName: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Values</Label>
        <div className="space-y-1">
          {cfg.values.map((val, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input
                placeholder={`value_${i + 1}`}
                value={val}
                onChange={(e) => updateValue(i, e.target.value)}
                className="h-8 text-xs"
              />
              {cfg.values.length > 1 && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeValue(i)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={addValue}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add Value
        </Button>
      </div>
    </div>
  );
}
