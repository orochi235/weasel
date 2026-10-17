/**
 * `useSnapDepSource` — wires the `snap` dep that `insertAction`, the pen, a
 * move and an anchor drag consume.
 *
 * Sourced from `<SceneCanvas toolOptions={{ pathSnap, snapPoint }} />`. A
 * path target in range wins; otherwise `snapPoint` (a grid, say) has the
 * point. The dep reads both through a ref, so toggling either takes effect on
 * the next gesture without remounting the registry.
 *
 * Always registered (hooks can't be conditional); with neither source the
 * dep's `point` is the identity function, which is the same behavior actions
 * fall back to when the dep is absent entirely.
 */
import { useDepSource } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import type { SnapDep } from 'interactions/actions/snapDep';
import type { PathSnapper } from 'features/paths/pathSnap/pathSnapper';
import type { View } from 'core/viewport/view';

type Point = { x: number; y: number };

/** Where the `snap` dep's answers come from. */
export interface SnapSources {
  /** `toolOptions.snapPoint`: any rule over a point, applied when no path
   *  target is in range. */
  snapPoint?: (p: Point) => Point;
  /** The canvas's path snapper, configured from `toolOptions.pathSnap`. */
  paths?: PathSnapper;
}

export function useSnapDepSource(sources: SnapSources, viewRef: React.RefObject<View | null>): void {
  const ref = useLatest(sources);

  useDepSource('snap', (): SnapDep => {
    const toPaths: NonNullable<SnapDep['toPaths']> = (p, at) =>
      ref.current.paths?.snap(p, at, viewRef.current?.scale ?? { x: 1, y: 1 }) ?? null;
    return {
      point: (p, at) => toPaths(p, at) ?? ref.current.snapPoint?.(p) ?? p,
      toPaths,
      release: () => ref.current.paths?.release(),
    };
  });
}
