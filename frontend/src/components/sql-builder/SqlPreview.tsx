import Editor from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';
import { Copy, ArrowDownToLine, Eraser } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface SqlPreviewProps {
  sql: string;
  onInsert: () => void;
  onClear: () => void;
}

/**
 * Read-only Monaco mini-editor showing generated SQL,
 * with Copy, Insert, and Clear action buttons.
 */
export function SqlPreview({ sql, onInsert, onClear }: SqlPreviewProps) {
  const { theme } = useTheme();
  const { toast } = useToast();

  const handleCopy = async () => {
    if (!sql) return;
    await navigator.clipboard.writeText(sql);
    toast({ title: 'Copied to clipboard' });
  };

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-md border">
        <Editor
          height={Math.min(200, Math.max(60, sql.split('\n').length * 20 + 20))}
          language="sql"
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          value={sql || '-- Select an operation and fill in the form above'}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            lineNumbers: 'off',
            scrollBeyondLastLine: false,
            fontSize: 12,
            wordWrap: 'on',
            automaticLayout: true,
            folding: false,
            glyphMargin: false,
            lineDecorationsWidth: 8,
            renderLineHighlight: 'none',
          }}
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={handleCopy} disabled={!sql}>
          <Copy className="mr-1 h-3.5 w-3.5" />
          Copy
        </Button>
        <Button size="sm" className="flex-1" onClick={onInsert} disabled={!sql}>
          <ArrowDownToLine className="mr-1 h-3.5 w-3.5" />
          Insert
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear}>
          <Eraser className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
