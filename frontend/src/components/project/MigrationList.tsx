import { Link } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
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
import { Edit, Download, Trash2 } from 'lucide-react';
import type { Migration } from '@shared/types';
import { analyzeSql } from '@shared/sql-analyzer';
import { RiskBadge } from '@/components/ui/risk-badge';
import * as api from '@/api/client';
import { useToast } from '@/components/ui/use-toast';
import { formatRelativeTime } from '@/lib/utils';

interface MigrationListProps {
  projectId: string;
  migrations: Migration[];
  onDeleted: () => void;
}

/**
 * Table listing all migrations for a project with action buttons.
 * Supports editing, exporting, and deleting individual migrations.
 */
export function MigrationList({ projectId, migrations, onDeleted }: MigrationListProps) {
  const { toast } = useToast();

  const handleDelete = async (id: string, version: number) => {
    try {
      await api.deleteMigration(id);
      toast({ title: 'Migration deleted', description: `V${version} has been deleted.` });
      onDeleted();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  if (migrations.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
        No migrations yet. Create one or import .sql files.
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Version</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-24">Risk</TableHead>
            <TableHead className="w-24">Lines</TableHead>
            <TableHead className="w-32">Modified</TableHead>
            <TableHead className="w-32 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {migrations.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="font-mono font-medium">V{m.version}</TableCell>
              <TableCell>{m.description}</TableCell>
              <TableCell>
                {(() => {
                  const analysis = analyzeSql(m.sqlContent);
                  return (
                    <RiskBadge risk={analysis.overallRisk} issueCount={analysis.issues.length} />
                  );
                })()}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {m.sqlContent.split('\n').length}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatRelativeTime(m.updatedAt)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" asChild>
                    <Link to={`/projects/${projectId}/migrations/${m.id}`}>
                      <Edit className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" asChild>
                    <a href={api.getExportMigrationUrl(m.id)} download>
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Migration V{m.version}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{m.description}". This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(m.id, m.version)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
