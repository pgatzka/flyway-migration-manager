import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { MigrationList } from '@/components/project/MigrationList';
import { CreateMigrationDialog } from '@/components/project/CreateMigrationDialog';
import { ImportDropZone } from '@/components/project/ImportDropZone';
import { useMigrations } from '@/hooks/use-migrations';
import { useToast } from '@/components/ui/use-toast';
import * as api from '@/api/client';
import type { Project } from '@shared/types';
import { analyzeSql } from '@shared/sql-analyzer';
import type { RiskLevel } from '@shared/sql-analyzer';
import {
  ArrowLeft,
  Download,
  Play,
  Trash2,
  ListOrdered,
  Check,
  Pencil,
  X,
  Database,
  Search,
  GitCompareArrows,
  GitBranch,
  Clock,
  Copy,
  Webhook,
  BarChart3,
} from 'lucide-react';

/**
 * Project detail page showing migrations list, import zone, and project actions.
 */
export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);
  const { migrations, loading: migrationsLoading, refresh } = useMigrations(id);

  // Inline name editing
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');

  // Clone project
  const [cloneName, setCloneName] = useState('');
  const [cloning, setCloning] = useState(false);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'all'>('all');

  const filteredMigrations = useMemo(() => {
    let result = migrations;

    // Text search — match version number or description
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (m) =>
          m.description.toLowerCase().includes(q) ||
          `v${m.version}`.includes(q) ||
          String(m.version).includes(q)
      );
    }

    // Risk filter
    if (riskFilter !== 'all') {
      result = result.filter((m) => {
        const analysis = analyzeSql(m.sqlContent);
        return analysis.overallRisk === riskFilter;
      });
    }

    return result;
  }, [migrations, searchQuery, riskFilter]);

  useEffect(() => {
    if (!id) return;
    setProjectLoading(true);
    api
      .getProject(id)
      .then((p) => {
        setProject(p);
        setEditName(p.name);
      })
      .catch((err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }))
      .finally(() => setProjectLoading(false));
  }, [id, toast]);

  const handleSaveName = async () => {
    if (!id || !editName.trim() || editName.trim() === project?.name) {
      setEditing(false);
      return;
    }
    try {
      const updated = await api.updateProject(id, { name: editName.trim() });
      setProject(updated);
      setEditing(false);
      toast({ title: 'Project renamed', description: `Renamed to "${updated.name}".` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await api.deleteProject(id);
      toast({ title: 'Project deleted' });
      navigate('/');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleRenumber = async () => {
    if (!id) return;
    try {
      await api.renumberMigrations(id);
      toast({ title: 'Migrations renumbered', description: 'Versions are now sequential.' });
      refresh();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleClone = async () => {
    if (!id || !cloneName.trim()) return;
    try {
      setCloning(true);
      const cloned = await api.cloneProject(id, cloneName.trim());
      toast({ title: 'Project cloned', description: `Created "${cloned.name}" with all migrations.` });
      navigate(`/projects/${cloned.id}`);
    } catch (err: any) {
      toast({ title: 'Clone failed', description: err.message, variant: 'destructive' });
    } finally {
      setCloning(false);
    }
  };

  if (projectLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-foreground">Project not found</h2>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link to="/">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Link>
        </Button>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {editing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  className="text-2xl font-bold h-10 w-64"
                  autoFocus
                />
                <Button size="icon" variant="ghost" onClick={handleSaveName}>
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setEditing(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditing(true)}
                  className="h-8 w-8"
                >
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <a href={api.getExportZipUrl(project.id)} download>
                <Download className="mr-2 h-4 w-4" />
                Export ZIP
              </a>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/projects/${project.id}/erd`}>
                <Database className="mr-2 h-4 w-4" />
                ERD
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/projects/${project.id}/timeline`}>
                <Clock className="mr-2 h-4 w-4" />
                Timeline
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/projects/${project.id}/dependencies`}>
                <GitBranch className="mr-2 h-4 w-4" />
                Dependencies
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/projects/${project.id}/schema-compare`}>
                <GitCompareArrows className="mr-2 h-4 w-4" />
                Compare
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/projects/${project.id}/stats`}>
                <BarChart3 className="mr-2 h-4 w-4" />
                Stats
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/projects/${project.id}/webhooks`}>
                <Webhook className="mr-2 h-4 w-4" />
                Webhooks
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/projects/${project.id}/validate`}>
                <Play className="mr-2 h-4 w-4" />
                Validate
              </Link>
            </Button>
            <AlertDialog onOpenChange={(open) => { if (open && project) setCloneName(project.name + ' (copy)'); }}>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <Copy className="mr-2 h-4 w-4" />
                  Clone
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clone project</AlertDialogTitle>
                  <AlertDialogDescription>
                    Create a copy of this project with all its migrations.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  placeholder="Name for the cloned project"
                  className="mt-2"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleClone(); }}
                />
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClone} disabled={cloning || !cloneName.trim()}>
                    {cloning ? 'Cloning...' : 'Clone'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete project "{project.name}"?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the project and all its migrations. This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Delete Project
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <Separator />

      {/* Import zone */}
      <ImportDropZone projectId={project.id} onImported={refresh} />

      <Separator />

      {/* Migrations section */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Migrations</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRenumber}>
              <ListOrdered className="mr-2 h-4 w-4" />
              Renumber
            </Button>
            <CreateMigrationDialog projectId={project.id} onCreated={refresh} />
          </div>
        </div>

        {/* Search & Filter bar */}
        {migrations.length > 0 && (
          <div className="mb-4 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by version or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as RiskLevel | 'all')}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="all">All Risks</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            {(searchQuery || riskFilter !== 'all') && (
              <span className="text-sm text-muted-foreground">
                {filteredMigrations.length} of {migrations.length}
              </span>
            )}
          </div>
        )}

        {migrationsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <MigrationList
            projectId={project.id}
            migrations={filteredMigrations}
            onDeleted={refresh}
          />
        )}
      </div>
    </div>
  );
}
