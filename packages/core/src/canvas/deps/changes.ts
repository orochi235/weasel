/**
 * `useDepChangeNotices` — tells the dep registry when the path-edit state
 * changed. Sources are thunks, so nothing else lets chrome showing an action's
 * `enabled` or `active` state know to read them again. The scene, history and
 * selection are watched where they are published, by `useStandardDeps`.
 */
import { useEffect } from 'react';
import { useDepRegistry } from '@weasel-js/routing/react';

export function useDepChangeNotices(
  pathEdit?: { subscribe?(listener: () => void): () => void },
): void {
  const registry = useDepRegistry();
  useEffect(() => pathEdit?.subscribe?.(() => registry.changed?.()), [pathEdit, registry]);
}
