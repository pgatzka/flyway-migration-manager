import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import * as api from '@/api/client';
import type { Annotation } from '@shared/types';
import { MessageSquare, Trash2, Send, User } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface AnnotationsPanelProps {
  migrationId: string;
}

/**
 * Panel for viewing and adding annotations (notes) on a migration.
 * Enables team collaboration by attaching notes to specific migrations.
 */
export function AnnotationsPanel({ migrationId }: AnnotationsPanelProps) {
  const { toast } = useToast();
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [author, setAuthor] = useState(() => localStorage.getItem('annotation-author') || '');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadAnnotations = useCallback(async () => {
    try {
      const data = await api.listAnnotations(migrationId);
      setAnnotations(data);
    } catch {
      // Silently fail — annotations are non-critical
    } finally {
      setLoading(false);
    }
  }, [migrationId]);

  useEffect(() => {
    loadAnnotations();
  }, [loadAnnotations]);

  const handleSubmit = async () => {
    if (!author.trim() || !content.trim()) return;
    try {
      setSubmitting(true);
      localStorage.setItem('annotation-author', author.trim());
      await api.createAnnotation(migrationId, {
        author: author.trim(),
        content: content.trim(),
      });
      setContent('');
      await loadAnnotations();
    } catch (err: any) {
      toast({ title: 'Failed to add note', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteAnnotation(id);
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      toast({ title: 'Failed to delete note', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="border rounded-lg bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <MessageSquare className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">Notes</span>
        <span className="text-xs text-muted-foreground">
          {annotations.length}
        </span>
      </div>

      {/* Notes list */}
      <ScrollArea className="max-h-[200px]">
        {loading ? (
          <div className="p-4 text-xs text-muted-foreground">Loading...</div>
        ) : annotations.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground text-center">
            No notes yet. Add a note for your team.
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {annotations.map((a) => (
              <div key={a.id} className="px-4 py-2 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium text-foreground">{a.author}</span>
                    <span className="text-muted-foreground">{formatDate(a.createdAt)}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDelete(a.id)}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
                <p className="text-sm text-foreground mt-1">{a.content}</p>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Add note form */}
      <div className="border-t p-3 space-y-2">
        <Input
          placeholder="Your name"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          className="h-7 text-xs"
        />
        <div className="flex gap-2">
          <Input
            placeholder="Add a note..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSubmit(); }}
            className="h-7 text-xs flex-1"
          />
          <Button
            size="sm"
            className="h-7 px-2"
            onClick={handleSubmit}
            disabled={submitting || !author.trim() || !content.trim()}
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
