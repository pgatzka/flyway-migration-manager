import { useState, useEffect, useCallback } from 'react';
import type { Migration } from '@shared/types';
import * as api from '@/api/client';

/**
 * Hook for fetching and managing migrations for a specific project.
 * Provides loading/error state and a refresh function.
 */
export function useMigrations(projectId: string | undefined) {
  const [migrations, setMigrations] = useState<Migration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.listMigrations(projectId);
      setMigrations(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load migrations');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { migrations, loading, error, refresh };
}
