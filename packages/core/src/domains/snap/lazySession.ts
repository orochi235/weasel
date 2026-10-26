import type { SnapBegin, SnapDep, SnapSession } from 'interactions/actions/snapDep';

/** A session of `dep` that begins on its first `at` or `angle`, so a press
 *  that never moves reads nothing of the scene. Null without a dep. */
export function lazySnapSession(dep: SnapDep | undefined, req: SnapBegin): SnapSession | null {
  if (!dep) return null;
  let begun: SnapSession | null = null;
  const session = () => (begun ??= dep.begin(req));
  return {
    at: (p, mods) => session().at(p, mods),
    angle: (theta, mods) => session().angle(theta, mods),
    end: () => begun?.end(),
  };
}
