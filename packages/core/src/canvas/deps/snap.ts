/**
 * `useSnapDepSource` — wires the `snap` dep that `insertAction`, the pen, a
 * move and an anchor drag consume.
 *
 * Sourced from `<SceneCanvas toolOptions={{ pathSnap, snapTargets, snapPoint }} />`.
 * A path target in range wins, then a point `snapTargets` offers; otherwise
 * `snapPoint` (a grid, say) has the point. The dep reads all three through a
 * ref, so toggling any takes effect on the next gesture without remounting
 * the registry.
 *
 * Always registered (hooks can't be conditional); with neither source the
 * dep's `point` is the identity function, which is the same behavior actions
 * fall back to when the dep is absent entirely.
 */
import { useDepSource } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import type { SnapDep, SnapQuery } from 'interactions/actions/snapDep';
import type { PathSnapper } from 'features/paths/pathSnap/pathSnapper';
import type { View } from 'core/viewport/view';

type Point = { x: number; y: number };

/** Where the `snap` dep's answers come from. */
export interface SnapSources {
  /** `toolOptions.snapPoint`: any rule over a point, applied when no path
   *  target is in range. */
  snapPoint?: (p: Point) => Point;
  /** `toolOptions.snapTargets`: points to lock to besides the scene's paths. */
  targets?: (p: Point, at?: SnapQuery) => Point | null;
  /** The canvas's path snapper, configured from `toolOptions.pathSnap`. */
  paths?: PathSnapper;
}

export function useSnapDepSource(sources: SnapSources, viewRef: React.RefObject<View | null>): void {
  const ref = useLatest(sources);

  useDepSource('snap', (): SnapDep => {
    // A query naming `include` asks for those nodes' geometry, which no
    // free-standing target is.
    const toTargets: NonNullable<SnapDep['toTargets']> = (p, at) =>
      ref.current.paths?.snap(p, at, viewRef.current?.scale ?? { x: 1, y: 1 })
        ?? (at?.include ? null : ref.current.targets?.(p, at))
        ?? null;
    return {
      point: (p, at) => toTargets(p, at) ?? ref.current.snapPoint?.(p) ?? p,
      toTargets,
      release: () => ref.current.paths?.release(),
    };
  });
}
