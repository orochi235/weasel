/**
 * A path effect's `foundHidden` names its sources by position, so a retarget
 * of its `dependsOn` carries the record along: every writer of `dependsOn`
 * goes through `scene.setDependsOn`, which asks this.
 */
import { pathEffectOf } from './derive';
import type { PathEffect } from './effects';

/**
 * `data` with its path effect's `foundHidden` moved from the positions the
 * sources held in `from` to the ones they hold in `to`, dropping a source
 * `to` no longer names; `null` where nothing moves.
 */
export function foundHiddenRetargeted(data: unknown, from: unknown, to: unknown): unknown {
  const effect = pathEffectOf({ data });
  const found = effect?.foundHidden;
  if (!effect || !found || found.length === 0) return null;
  const was = Array.isArray(from) ? from : [];
  const ids = new Set(found.map((at) => was[at]));
  const next = (Array.isArray(to) ? to : []).flatMap((id, at) => (ids.has(id) ? [at] : []));
  if (next.length === found.length && next.every((at, k) => at === found[k])) return null;
  const moved: PathEffect = { ...effect, foundHidden: next };
  if (next.length === 0) delete moved.foundHidden;
  return { ...(data as object), pathEffect: moved };
}
