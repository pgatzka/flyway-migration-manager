import { useProjects } from '@/hooks/use-projects';
import { ProjectCard } from '@/components/dashboard/ProjectCard';
import { CreateProjectDialog } from '@/components/dashboard/CreateProjectDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { FolderOpen } from 'lucide-react';

/**
 * Dashboard page showing a grid of all projects with their statistics.
 * Includes a button to create new projects.
 */
export function DashboardPage() {
  const { projects, loading, error, refresh } = useProjects();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground">Manage your Flyway migration projects</p>
        </div>
        <CreateProjectDialog onCreated={refresh} />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-16">
          <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-medium text-foreground">No projects yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first project to start managing migrations.
          </p>
          <div className="mt-4">
            <CreateProjectDialog onCreated={refresh} />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
