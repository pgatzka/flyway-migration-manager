import { useState, useCallback } from 'react';
import { Upload, FileUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as api from '@/api/client';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface ImportDropZoneProps {
  projectId: string;
  onImported: () => void;
}

/**
 * Drag-and-drop zone for importing .sql files.
 * Accepts multiple files and uploads them as multipart form data.
 */
export function ImportDropZone({ projectId, onImported }: ImportDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
      f.name.endsWith('.sql')
    );
    if (droppedFiles.length === 0) {
      toast({ title: 'Invalid files', description: 'Only .sql files are accepted.', variant: 'destructive' });
      return;
    }
    setFiles((prev) => [...prev, ...droppedFiles]);
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files).filter((f) => f.name.endsWith('.sql'));
      setFiles((prev) => [...prev, ...selected]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    try {
      setUploading(true);
      const result = await api.importMigrations(projectId, files);
      toast({
        title: 'Import successful',
        description: `Imported ${result.length} migration${result.length !== 1 ? 's' : ''}.`,
      });
      setFiles([]);
      onImported();
    } catch (err: any) {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors',
          dragOver
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-950'
            : 'border-border bg-muted hover:border-muted-foreground/30'
        )}
      >
        <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Drag & drop .sql files here, or{' '}
          <label className="cursor-pointer font-medium text-blue-600 hover:text-blue-400">
            browse
            <input
              type="file"
              multiple
              accept=".sql"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Files must follow Flyway naming: V&#123;version&#125;__&#123;description&#125;.sql
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="max-h-32 space-y-1 overflow-y-auto">
            {files.map((file, i) => (
              <div
                key={`${file.name}-${i}`}
                className="flex items-center justify-between rounded bg-muted px-3 py-1.5 text-sm"
              >
                <div className="flex items-center gap-2">
                  <FileUp className="h-4 w-4 text-muted-foreground" />
                  {file.name}
                </div>
                <button
                  onClick={() => removeFile(i)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <Button onClick={handleUpload} disabled={uploading} className="w-full">
            {uploading ? 'Importing...' : `Import ${files.length} file${files.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      )}
    </div>
  );
}
