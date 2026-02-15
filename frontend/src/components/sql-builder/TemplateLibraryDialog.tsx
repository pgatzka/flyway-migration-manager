import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TEMPLATE_CATEGORIES, type MigrationTemplate } from '@/lib/migration-templates';
import { Library, Copy, FileCode, Check } from 'lucide-react';

interface TemplateLibraryDialogProps {
  onInsert: (sql: string) => void;
}

/**
 * Dialog that shows pre-built migration templates organized by category.
 * Users can preview and insert templates into the editor.
 */
export function TemplateLibraryDialog({ onInsert }: TemplateLibraryDialogProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<MigrationTemplate | null>(null);
  const [copied, setCopied] = useState(false);

  const handleInsert = () => {
    if (!selected) return;
    onInsert(selected.sql);
    setOpen(false);
    setSelected(null);
  };

  const handleCopy = async () => {
    if (!selected) return;
    await navigator.clipboard.writeText(selected.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSelected(null); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Library className="mr-2 h-4 w-4" />
          Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="h-5 w-5" />
            Migration Templates
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 gap-4 min-h-0">
          {/* Template list */}
          <ScrollArea className="w-1/3 border rounded-lg">
            <div className="p-2">
              {TEMPLATE_CATEGORIES.map((cat) => (
                <div key={cat.label} className="mb-3">
                  <div className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                    {cat.label}
                  </div>
                  {cat.templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelected(t)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        selected?.id === t.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <div className="font-medium">{t.name}</div>
                      <div className={`text-xs mt-0.5 ${
                        selected?.id === t.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      }`}>
                        {t.description.slice(0, 60)}...
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Preview panel */}
          <div className="flex-1 flex flex-col min-h-0">
            {selected ? (
              <>
                <div className="mb-3">
                  <h3 className="text-lg font-semibold text-foreground">{selected.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{selected.description}</p>
                </div>
                <div className="flex-1 min-h-0 overflow-auto rounded-lg border bg-muted/50">
                  <pre className="p-4 text-sm font-mono text-foreground whitespace-pre-wrap">
                    {selected.sql}
                  </pre>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button onClick={handleInsert} className="flex-1">
                    <FileCode className="mr-2 h-4 w-4" />
                    Insert into Editor
                  </Button>
                  <Button variant="outline" onClick={handleCopy}>
                    {copied ? (
                      <><Check className="mr-2 h-4 w-4" /> Copied</>
                    ) : (
                      <><Copy className="mr-2 h-4 w-4" /> Copy</>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Select a template to preview
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
