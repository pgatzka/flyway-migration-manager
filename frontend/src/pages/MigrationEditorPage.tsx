import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Editor, { DiffEditor } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { RiskBadge } from '@/components/ui/risk-badge';
import { SqlBuilderPanel } from '@/components/sql-builder/SqlBuilderPanel';
import { useSchemaSnapshot } from '@/hooks/use-schema-snapshot';
import * as api from '@/api/client';
import type { Migration } from '@shared/types';
import { analyzeSql } from '@shared/sql-analyzer';
import type { SqlAnalysisResult } from '@shared/sql-analyzer';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { generateRollbackSql } from '@/lib/rollback-generator';
import { TemplateLibraryDialog } from '@/components/sql-builder/TemplateLibraryDialog';
import { DryRunPanel } from '@/components/migration/DryRunPanel';
import { AnnotationsPanel } from '@/components/migration/AnnotationsPanel';
import { ArrowLeft, Save, Download, Trash2, WrapText, ShieldAlert, GitCompareArrows, Undo2, Blocks, Sparkles, FlaskConical, MessageSquare } from 'lucide-react';
import { format as formatSql } from 'sql-formatter';

/**
 * Full-page migration editor with Monaco Editor for SQL editing.
 * Supports editing description, version number, and SQL content.
 */
export function MigrationEditorPage() {
  const { id: projectId, migId } = useParams<{ id: string; migId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [migration, setMigration] = useState<Migration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const { theme } = useTheme();
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('');
  const [sqlContent, setSqlContent] = useState('');
  const [downSqlContent, setDownSqlContent] = useState('');
  const [activeTab, setActiveTab] = useState<'up' | 'down'>('up');
  const [showDiff, setShowDiff] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [dryRunOpen, setDryRunOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const { schema } = useSchemaSnapshot(projectId);

  const handleInsertSql = useCallback((sql: string) => {
    const ed = editorRef.current;
    if (!ed) {
      // Fallback: append to current content
      const setter = activeTab === 'up' ? setSqlContent : setDownSqlContent;
      const current = activeTab === 'up' ? sqlContent : downSqlContent;
      setter(current ? current + '\n\n' + sql : sql);
      return;
    }
    const position = ed.getPosition();
    if (position) {
      ed.executeEdits('sql-builder', [{
        range: {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        },
        text: sql + '\n',
        forceMoveMarkers: true,
      }]);
      ed.focus();
    }
  }, [activeTab, sqlContent, downSqlContent]);

  useEffect(() => {
    if (!migId) return;
    setLoading(true);
    api
      .getMigration(migId)
      .then((m) => {
        setMigration(m);
        setDescription(m.description);
        setVersion(String(m.version));
        setSqlContent(m.sqlContent);
        setDownSqlContent(m.downSqlContent);
      })
      .catch((err) => {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      })
      .finally(() => setLoading(false));
  }, [migId, toast]);

  // Detect if there are unsaved changes
  const hasChanges =
    migration !== null &&
    (description !== migration.description ||
      version !== String(migration.version) ||
      sqlContent !== migration.sqlContent ||
      downSqlContent !== migration.downSqlContent);

  // Warn before leaving with unsaved changes
  const blocker = useUnsavedChanges(hasChanges);

  const handleSave = async () => {
    if (!migId) return;

    const versionNum = parseInt(version, 10);
    if (isNaN(versionNum) || versionNum < 1) {
      toast({ title: 'Invalid version', description: 'Version must be a positive integer.', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      const updated = await api.updateMigration(migId, {
        description: description.trim(),
        version: versionNum,
        sqlContent,
        downSqlContent,
      });
      setMigration(updated);
      toast({ title: 'Migration saved' });
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!migId || !projectId) return;
    try {
      await api.deleteMigration(migId);
      toast({ title: 'Migration deleted' });
      navigate(`/projects/${projectId}`);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleFormat = () => {
    const content = activeTab === 'up' ? sqlContent : downSqlContent;
    const setter = activeTab === 'up' ? setSqlContent : setDownSqlContent;
    try {
      const formatted = formatSql(content, {
        language: 'postgresql',
        tabWidth: 2,
        keywordCase: 'upper',
        dataTypeCase: 'upper',
        functionCase: 'upper',
      });
      setter(formatted);
      toast({ title: 'SQL formatted' });
    } catch {
      toast({ title: 'Format failed', description: 'Could not format the SQL content.', variant: 'destructive' });
    }
  };

  // Run SQL analysis whenever content changes
  const analysis: SqlAnalysisResult = useMemo(() => analyzeSql(sqlContent), [sqlContent]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!migration) {
    return (
      <div className="py-16 text-center">
        <h2 className="text-xl font-semibold text-foreground">Migration not found</h2>
        <Button asChild className="mt-4" variant="outline">
          <Link to={`/projects/${projectId}`}>Back to Project</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/projects/${projectId}`}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Project
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <RiskBadge risk={analysis.overallRisk} issueCount={analysis.issues.length} />
          <Button variant="outline" size="sm" asChild>
            <a href={api.getExportMigrationUrl(migration.id)} download>
              <Download className="mr-2 h-4 w-4" />
              Export
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={handleFormat}>
            <WrapText className="mr-2 h-4 w-4" />
            Format
          </Button>
          <Button
            variant={dryRunOpen ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDryRunOpen(!dryRunOpen)}
          >
            <FlaskConical className="mr-2 h-4 w-4" />
            Dry Run
          </Button>
          <Button
            variant={notesOpen ? 'default' : 'outline'}
            size="sm"
            onClick={() => setNotesOpen(!notesOpen)}
          >
            <MessageSquare className="mr-2 h-4 w-4" />
            Notes
          </Button>
          <TemplateLibraryDialog onInsert={handleInsertSql} />
          <Button
            variant={builderOpen ? 'default' : 'outline'}
            size="sm"
            onClick={() => setBuilderOpen(!builderOpen)}
          >
            <Blocks className="mr-2 h-4 w-4" />
            SQL Builder
          </Button>
          {hasChanges && (
            <Button
              variant={showDiff ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowDiff(!showDiff)}
            >
              <GitCompareArrows className="mr-2 h-4 w-4" />
              Diff
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this migration?</AlertDialogTitle>
                <AlertDialogDescription>
                  V{migration.version} — "{migration.description}" will be permanently deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={handleSave} disabled={!hasChanges || saving} size="sm">
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Metadata fields */}
      <div className="flex gap-4">
        <div className="w-24">
          <Label htmlFor="version">Version</Label>
          <Input
            id="version"
            type="number"
            min={1}
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="mt-1"
          />
        </div>
        <div className="flex-1">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>

      {/* Editor + Builder Panel layout */}
      <div className="flex gap-0">
        {/* Editor column */}
        <div className="min-w-0 flex-1 space-y-4">
          {/* Up / Down SQL Tabs */}
          <div className="flex items-center gap-1 border-b">
            <button
              onClick={() => setActiveTab('up')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'up'
                  ? 'border-b-2 border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Up (Migrate)
            </button>
            <button
              onClick={() => setActiveTab('down')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'down'
                  ? 'border-b-2 border-primary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Undo2 className="h-3.5 w-3.5" />
              Down (Rollback)
              {downSqlContent && (
                <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                  {downSqlContent.split('\n').length}L
                </span>
              )}
            </button>
            {activeTab === 'down' && sqlContent && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-xs"
                onClick={() => {
                  const rollback = generateRollbackSql(sqlContent);
                  if (rollback) {
                    setDownSqlContent(rollback);
                    toast({ title: 'Rollback SQL generated', description: 'Review the generated SQL carefully before saving.' });
                  } else {
                    toast({ title: 'No rollback generated', description: 'Could not parse the UP SQL content.', variant: 'destructive' });
                  }
                }}
              >
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                Auto-Generate Rollback
              </Button>
            )}
          </div>

          {/* Monaco Editor */}
          <div className="overflow-hidden rounded-lg border">
            {showDiff && migration && activeTab === 'up' ? (
              <DiffEditor
                height={analysis.issues.length > 0 ? 'calc(100vh - 460px)' : 'calc(100vh - 320px)'}
                language="sql"
                theme={theme === 'dark' ? 'vs-dark' : 'light'}
                original={migration.sqlContent}
                modified={sqlContent}
                options={{
                  readOnly: false,
                  renderSideBySide: true,
                  minimap: { enabled: false },
                  fontSize: 14,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
                onMount={(diffEditor) => {
                  // Sync modified editor changes back to state
                  const modifiedEditor = diffEditor.getModifiedEditor();
                  editorRef.current = modifiedEditor;
                  modifiedEditor.onDidChangeModelContent(() => {
                    setSqlContent(modifiedEditor.getValue());
                  });
                }}
              />
            ) : (
            <Editor
              height={analysis.issues.length > 0 ? 'calc(100vh - 460px)' : 'calc(100vh - 320px)'}
              language="sql"
              theme={theme === 'dark' ? 'vs-dark' : 'light'}
              value={activeTab === 'up' ? sqlContent : downSqlContent}
              onChange={(value) => activeTab === 'up' ? setSqlContent(value || '') : setDownSqlContent(value || '')}
              options={{
                minimap: { enabled: true },
                lineNumbers: 'on',
                bracketPairColorization: { enabled: true },
                matchBrackets: 'always',
                fontSize: 14,
                tabSize: 2,
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                suggestOnTriggerCharacters: true,
                quickSuggestions: true,
              }}
              onMount={(editorInstance, monaco) => {
                editorRef.current = editorInstance;

                // Register SQL keyword completions
                monaco.languages.registerCompletionItemProvider('sql', {
                  provideCompletionItems: (model, position) => {
                    const keywords = [
                      'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
                      'DELETE', 'CREATE', 'TABLE', 'ALTER', 'DROP', 'INDEX', 'VIEW', 'TRIGGER',
                      'FUNCTION', 'PROCEDURE', 'DATABASE', 'SCHEMA', 'SEQUENCE', 'TYPE', 'ENUM',
                      'ADD', 'COLUMN', 'CONSTRAINT', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES',
                      'UNIQUE', 'NOT', 'NULL', 'DEFAULT', 'CHECK', 'CASCADE', 'RESTRICT',
                      'ON', 'AND', 'OR', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS', 'AS',
                      'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'CROSS', 'NATURAL', 'FULL',
                      'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL',
                      'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'IF', 'ELSIF',
                      'BEGIN', 'COMMIT', 'ROLLBACK', 'TRANSACTION', 'GRANT', 'REVOKE',
                      'INTEGER', 'BIGINT', 'SMALLINT', 'SERIAL', 'BIGSERIAL', 'BOOLEAN',
                      'VARCHAR', 'TEXT', 'CHAR', 'TIMESTAMP', 'DATE', 'TIME', 'INTERVAL',
                      'NUMERIC', 'DECIMAL', 'REAL', 'DOUBLE', 'PRECISION', 'UUID', 'JSON',
                      'JSONB', 'BYTEA', 'ARRAY', 'RETURNS', 'LANGUAGE', 'PLPGSQL', 'DECLARE',
                      'RAISE', 'NOTICE', 'EXCEPTION', 'PERFORM', 'EXECUTE', 'USING',
                      'WITH', 'RECURSIVE', 'MATERIALIZED', 'CONCURRENTLY', 'ONLY',
                      'RENAME', 'TO', 'OWNER', 'TABLESPACE', 'COMMENT', 'EXTENSION',
                      'IF EXISTS', 'IF NOT EXISTS', 'CREATE TABLE', 'ALTER TABLE',
                      'DROP TABLE', 'CREATE INDEX', 'CREATE UNIQUE INDEX',
                    ];

                    const word = model.getWordUntilPosition(position);
                    const range = {
                      startLineNumber: position.lineNumber,
                      endLineNumber: position.lineNumber,
                      startColumn: word.startColumn,
                      endColumn: word.endColumn,
                    };

                    return {
                      suggestions: keywords.map((kw) => ({
                        label: kw,
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: kw,
                        range,
                      })),
                    };
                  },
                });

                // Register Shift+Alt+F as format shortcut (same as VS Code)
                editorInstance.addAction({
                  id: 'format-sql',
                  label: 'Format SQL',
                  keybindings: [
                    monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
                  ],
                  run: () => {
                    try {
                      const current = editorInstance.getValue();
                      const formatted = formatSql(current, {
                        language: 'postgresql',
                        tabWidth: 2,
                        keywordCase: 'upper',
                        dataTypeCase: 'upper',
                        functionCase: 'upper',
                      });
                      editorInstance.setValue(formatted);
                    } catch {
                      // Formatting failed, leave content as-is
                    }
                  },
                });
              }}
            />
            )}
          </div>

          {/* Dry Run Panel */}
          {dryRunOpen && activeTab === 'up' && (
            <DryRunPanel sqlContent={sqlContent} />
          )}

          {/* Annotations Panel */}
          {notesOpen && migId && (
            <AnnotationsPanel migrationId={migId} />
          )}

          {/* Lint Issues Panel (only for Up SQL) */}
          {activeTab === 'up' && analysis.issues.length > 0 && (
            <div className="rounded-lg border bg-card">
              <div className="flex items-center gap-2 border-b px-4 py-2 text-sm font-medium text-foreground">
                <ShieldAlert className="h-4 w-4" />
                {analysis.issues.length} issue{analysis.issues.length > 1 ? 's' : ''} found
              </div>
              <div className="max-h-32 overflow-y-auto">
                {analysis.issues.map((issue, i) => {
                  const severityColors: Record<string, string> = {
                    critical: 'border-l-red-600 bg-red-50',
                    high: 'border-l-orange-500 bg-orange-50',
                    medium: 'border-l-yellow-500 bg-yellow-50',
                    low: 'border-l-green-500 bg-green-50',
                  };
                  return (
                    <div
                      key={i}
                      className={`flex items-start gap-3 border-l-4 px-4 py-2 text-sm ${severityColors[issue.severity] || ''}`}
                    >
                      <div className="flex-1">
                        <div className="font-medium text-foreground">
                          {issue.message}
                          {issue.line && (
                            <span className="ml-2 font-mono text-xs text-muted-foreground">
                              line {issue.line}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-muted-foreground">{issue.suggestion}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* SQL Builder Panel */}
        {builderOpen && (
          <div className="w-[420px] shrink-0">
            <SqlBuilderPanel schema={schema} onInsertSql={handleInsertSql} />
          </div>
        )}
      </div>

      {/* Unsaved changes navigation blocker */}
      {blocker.state === 'blocked' && (
        <AlertDialog open onOpenChange={() => blocker.reset()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved changes to this migration. Are you sure you want to leave? Your changes will be lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => blocker.reset()}>Stay</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => blocker.proceed()}
                className="bg-red-600 hover:bg-red-700"
              >
                Leave
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
