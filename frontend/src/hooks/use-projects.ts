import { useState, useEffect, useCallback } from 'react';
import type { ProjectWithStats } from '@shared/types';
import * as api from '@/api/client';

/**
 * Hook for fetching and managing the list of projects with stats.
 * Provides loading/error state and a refresh function.
 */
export function useProjects() {
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listProjects();
      setProjects(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { projects, loading, error, refresh };
}
