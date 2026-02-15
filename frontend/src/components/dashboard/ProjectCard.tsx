import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileCode, Calendar, Clock, CheckCircle, XCircle, Activity } from 'lucide-react';
import type { ProjectWithStats } from '@shared/types';
import { formatDate, formatRelativeTime } from '@/lib/utils';

interface ProjectCardProps {
  project: ProjectWithStats;
}

/**
 * Dashboard card displaying a project's name and key statistics.
 * Links to the project detail page.
 */
export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link to={`/projects/${project.id}`} className="block">
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg">{project.name}</CardTitle>
            {project.lastValidation && (
              <Badge
                variant={project.lastValidation.status === 'pass' ? 'success' : 'destructive'}
              >
                {project.lastValidation.status === 'pass' ? (
                  <CheckCircle className="mr-1 h-3 w-3" />
                ) : (
                  <XCircle className="mr-1 h-3 w-3" />
                )}
                {project.lastValidation.status.toUpperCase()}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <FileCode className="h-4 w-4 text-muted-foreground" />
              <span>
                {project.migrationCount} migration{project.migrationCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span>{project.totalSqlLineCount} SQL lines</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                {project.lastModified
                  ? formatRelativeTime(project.lastModified)
                  : 'No migrations'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{formatDate(project.createdAt)}</span>
            </div>
          </div>

          {(project.validationPassCount > 0 || project.validationFailCount > 0) && (
            <div className="mt-3 flex items-center gap-3 border-t pt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                {project.validationPassCount} passed
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-500" />
                {project.validationFailCount} failed
              </span>
              {project.lastValidation && (
                <span className="ml-auto">
                  Last: {formatRelativeTime(project.lastValidation.executedAt)}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
