import { useEffect, useCallback } from 'react';
import { useBlocker, type BlockerFunction } from 'react-router-dom';

/**
 * Hook that warns the user when they attempt to leave a page with unsaved changes.
 * Handles both browser navigation (beforeunload) and in-app React Router navigation.
 * @param hasChanges - Whether there are unsaved changes
 */
export function useUnsavedChanges(hasChanges: boolean) {
  // Browser tab close / external navigation
  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasChanges]);

  // React Router in-app navigation
  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) =>
      hasChanges && currentLocation.pathname !== nextLocation.pathname,
    [hasChanges]
  );
  const blocker = useBlocker(shouldBlock);

  return blocker;
}
