import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ThemeProvider } from '@/hooks/use-theme';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProjectPage } from '@/pages/ProjectPage';
import { MigrationEditorPage } from '@/pages/MigrationEditorPage';
import { ValidationPage } from '@/pages/ValidationPage';
import { ERDPage } from '@/pages/ERDPage';
import { SchemaComparisonPage } from '@/pages/SchemaComparisonPage';
import { DependencyGraphPage } from '@/pages/DependencyGraphPage';
import { SchemaTimelinePage } from '@/pages/SchemaTimelinePage';
import { WebhookSettingsPage } from '@/pages/WebhookSettingsPage';
import { StatsPage } from '@/pages/StatsPage';

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <DashboardPage /> },
      { path: '/projects/:id', element: <ProjectPage /> },
      { path: '/projects/:id/migrations/:migId', element: <MigrationEditorPage /> },
      { path: '/projects/:id/validate', element: <ValidationPage /> },
      { path: '/projects/:id/erd', element: <ERDPage /> },
      { path: '/projects/:id/schema-compare', element: <SchemaComparisonPage /> },
      { path: '/projects/:id/dependencies', element: <DependencyGraphPage /> },
      { path: '/projects/:id/timeline', element: <SchemaTimelinePage /> },
      { path: '/projects/:id/webhooks', element: <WebhookSettingsPage /> },
      { path: '/projects/:id/stats', element: <StatsPage /> },
    ],
  },
]);

/**
 * Root application component with client-side routing.
 */
export function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}
