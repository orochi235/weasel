/**
 * `useDepChangeNotices` — tells the dep registry when the scene or the
 * selection changed. Sources are thunks, so nothing else lets chrome showing
 * an action's `enabled` or `active` state know to read them again.
 */
import { useEffect } from 'react';
import { useDepRegistry } from '@weasel-js/routing/react';

export function useDepChangeNotices(
  scene: { subscribe(listener: () => void): () => void },
  selected: readonly unknown[],
): void {
  const registry = useDepRegistry();
  useEffect(() => scene.subscribe(() => registry.changed?.()), [scene, registry]);
  useEffect(() => { registry.changed?.(); }, [registry, selected]);
}
