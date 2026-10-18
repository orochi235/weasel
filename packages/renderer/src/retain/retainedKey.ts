import type { GlMat3, Path } from '@weasel-js/geom';
import type { DrawCommand } from '../DrawCommand';

/** Everything a retained group's pixels were drawn under. Two keys that
 *  compare equal draw the same pixels. */
export interface RetainedKey {
  children: readonly DrawCommand[];
  transform: GlMat3;
  alpha: number;
  colorMatrix: Float32Array;
  viewMatrix: GlMat3 | undefined;
  /** Every clip enclosing the group, outermost first, its own last. */
  clips: readonly RetainedClip[];
}

/** A clip path and the transform it is in. */
export interface RetainedClip {
  path: Path;
  transform: GlMat3;
}

/** A copy of `key` that no later write to the caller's matrices reaches. */
export function keepKey(key: RetainedKey): RetainedKey {
  return {
    ...key,
    transform: key.transform.slice(),
    colorMatrix: key.colorMatrix.slice(),
    viewMatrix: key.viewMatrix?.slice(),
    clips: key.clips.map((c) => ({ path: c.path, transform: c.transform.slice() })),
  };
}

export function sameKey(a: RetainedKey, b: RetainedKey): boolean {
  return a.children === b.children && a.alpha === b.alpha
    && sameFloats(a.transform, b.transform) && sameFloats(a.colorMatrix, b.colorMatrix)
    && (a.viewMatrix === undefined ? b.viewMatrix === undefined
      : b.viewMatrix !== undefined && sameFloats(a.viewMatrix, b.viewMatrix))
    && sameClips(a.clips, b.clips);
}

function sameClips(a: readonly RetainedClip[], b: readonly RetainedClip[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].path !== b[i].path || !sameFloats(a[i].transform, b[i].transform)) return false;
  }
  return true;
}

function sameFloats(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Stamps compared entry by entry. */
export function sameStamp(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
}
