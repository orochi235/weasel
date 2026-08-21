/**
 * `useSliceDep` — wires a consumer-supplied `SliceDep` into the surrounding
 * dep registry so the kit `sliceAction` can call it on drag-release.
 *
 * Call inside a component mounted under `<SceneCanvas>` (which provides
 * `<DepRegistryProvider>`). Built once per render and stabilised by
 * `useDepSource` (which reads via a ref internally), so callers can pass
 * fresh closures without triggering re-registration.
 *
 * @see SliceDep — the dep contract (`commit(a, b)` in world coords).
 */
import { useRef } from 'react';
import { useDepSource } from 'interactions/actions/depRegistry';
import type { SliceDep } from 'interactions/actions/defaults/slice';

/** Publish how a slice (knife cut) is performed, so the `slice` action can
 *  run against the consumer's geometry. */
export function useSliceDep(dep: SliceDep): void {
  const depRef = useRef(dep);
  depRef.current = dep;

  useDepSource('slice', (): SliceDep => depRef.current);
}
