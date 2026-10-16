/**
 * `useDepChangeNotices` — tells the dep registry when the scene, the
 * selection, or the path-edit state changed. Sources are thunks, so nothing else lets chrome showing
 * an action's `enabled` or `active` state know to read them again.
 */
import { useEffect } from 'react';
import { useDepRegistry } from '@weasel-js/routing/react';

export function useDepChangeNotices(
  scene: { subscribe(listener: () => void): () => void },
  selected: readonly unknown[],
  pathEdit?: { subscribe?(listener: () => void): () => void },
): void {
  const registry = useDepRegistry();
  useEffect(() => scene.subscribe(() => registry.changed?.()), [scene, registry]);
  useEffect(() => pathEdit?.subscribe?.(() => registry.changed?.()), [pathEdit, registry]);
  useEffect(() => { registry.changed?.(); }, [registry, selected]);
}
