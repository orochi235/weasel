/**
 * `useDepChangeNotices` — tells the dep registry when the path-edit state or the
 * active mode changed. Sources are thunks, so nothing else lets chrome showing an
 * action's `enabled`, `active` or mode eligibility know to read them again. The
 * scene, history and selection are watched where they are published, by `useStandardDeps`.
 */
import { useEffect } from 'react';
import { useDepRegistry } from '@weasel-js/routing/react';

type Changes = { subscribe?(listener: () => void): () => void } | undefined;

export function useDepChangeNotices(pathEdit?: Changes, modes?: Changes): void {
  const registry = useDepRegistry();
  useEffect(() => pathEdit?.subscribe?.(() => registry.changed?.()), [pathEdit, registry]);
  useEffect(() => modes?.subscribe?.(() => registry.changed?.()), [modes, registry]);
}
