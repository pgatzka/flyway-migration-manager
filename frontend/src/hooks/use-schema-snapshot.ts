import { useState, useEffect, useCallback } from 'react';
import * as api from '@/api/client';
import type { SchemaSnapshot } from '@shared/types';

/**
 * Fetches and caches the latest schema snapshot for a project.
 * Returns null when no schema exists (graceful degradation).
 */
export function useSchemaSnapshot(projectId: string | undefined) {
  const [schema, setSchema] = useState<SchemaSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError(null);
      const snapshot = await api.getSchemaSnapshot(projectId);
      setSchema(snapshot);
    } catch (err: any) {
      setError(err.message || 'Failed to load schema');
      setSchema(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { schema, loading, error, refresh };
}
