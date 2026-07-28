/**
 * `useSnapDepSource` — wires the `snap` dep consumed by `insertAction`.
 *
 * Sourced from `<SceneCanvas toolOptions={{ snapPoint }} />`. The dep is a
 * live thunk over a ref, so toggling snap on/off (WeaselDraw's snap-to-grid
 * switch) takes effect on the next gesture without remounting the registry.
 *
 * Always registered (hooks can't be conditional); when no `snapPoint` is
 * supplied the dep's `point` is the identity function, which is the same
 * behavior actions fall back to when the dep is absent entirely.
 */
import { useRef } from 'react';
import { useDepSource } from 'interactions/actions/depRegistry';
import type { SnapDep } from 'interactions/actions/depSchema';

export function useSnapDepSource(
  snapPoint: ((p: { x: number; y: number }) => { x: number; y: number }) | undefined,
): void {
  const snapRef = useRef(snapPoint);
  snapRef.current = snapPoint;

  useDepSource('snap', (): SnapDep => ({
    point: (p) => snapRef.current?.(p) ?? p,
  }));
}
