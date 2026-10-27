import type { GlMat3, Path } from '@weasel-js/geom';
import type { DrawCommand } from '../DrawCommand';
import type { Effect } from '../effects/types';
import type { ShaderUniform } from '../shaders/registerProgram';

/** Everything a retained group's pixels were drawn under. Two keys that
 *  compare equal draw the same pixels. */
export interface RetainedKey {
  children: readonly DrawCommand[];
  transform: GlMat3;
  alpha: number;
  colorMatrix: Float32Array;
  viewMatrix: GlMat3 | undefined;
  screenMatrix?: GlMat3;
  /** Every clip enclosing the group, outermost first, its own last. */
  clips: readonly RetainedClip[];
  /** The group's own `effects` and `isolate`, for a group that owns a surface. */
  effects?: readonly Effect[];
  isolate?: boolean;
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
    screenMatrix: key.screenMatrix?.slice(),
    clips: key.clips.map((c) => ({ path: c.path, transform: c.transform.slice() })),
  };
}

export function sameKey(a: RetainedKey, b: RetainedKey): boolean {
  return a.children === b.children && a.alpha === b.alpha
    && sameFloats(a.transform, b.transform) && sameFloats(a.colorMatrix, b.colorMatrix)
    && sameMatrix(a.viewMatrix, b.viewMatrix) && sameMatrix(a.screenMatrix, b.screenMatrix)
    && sameClips(a.clips, b.clips) && a.isolate === b.isolate && sameEffects(a.effects, b.effects);
}

/**
 * How far `b`'s pixels sit from `a`'s, in CSS pixels, when the two differ
 * only by a translation of everything they were drawn under: the transform,
 * the view matrix and every clip moved by the same amount. `null` otherwise.
 * `[0, 0]` for keys that compare equal.
 */
export function keyShift(a: RetainedKey, b: RetainedKey): readonly [number, number] | null {
  if (a.children !== b.children || a.alpha !== b.alpha || a.isolate !== b.isolate) return null;
  if (!sameFloats(a.colorMatrix, b.colorMatrix) || !sameMatrix(a.screenMatrix, b.screenMatrix)) return null;
  if (!sameEffects(a.effects, b.effects) || a.clips.length !== b.clips.length) return null;
  const shift = translationBetween(a.transform, b.transform);
  if (!shift) return null;
  const moved = (x: GlMat3 | undefined, y: GlMat3 | undefined): boolean => {
    if (x === undefined || y === undefined) return x === y;
    const s = translationBetween(x, y);
    return s !== null && near(s[0], shift[0]) && near(s[1], shift[1]);
  };
  if (!moved(a.viewMatrix, b.viewMatrix)) return null;
  for (let i = 0; i < a.clips.length; i++) {
    if (a.clips[i].path !== b.clips[i].path || !moved(a.clips[i].transform, b.clips[i].transform)) return null;
  }
  return shift;
}

/** `b`'s translation less `a`'s, when nothing else about them differs. */
function translationBetween(a: GlMat3, b: GlMat3): [number, number] | null {
  for (const i of [0, 1, 2, 3, 4, 5, 8]) if (a[i] !== b[i]) return null;
  return [b[6] - a[6], b[7] - a[7]];
}

/** Translations composed through different matrices round differently. */
function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
}

/** Effects compared by what they run, so a list rebuilt each frame with the
 *  same passes still matches. */
function sameEffects(a: readonly Effect[] | undefined, b: readonly Effect[] | undefined): boolean {
  if (a === b) return true;
  if ((a?.length ?? 0) !== (b?.length ?? 0)) return false;
  for (let i = 0; i < (a?.length ?? 0); i++) {
    const x = a![i], y = b![i];
    if (x.program.id !== y.program.id || x.reach !== y.reach || !sameUniforms(x.uniforms, y.uniforms)) return false;
  }
  return true;
}

function sameUniforms(a: Record<string, ShaderUniform> | undefined, b: Record<string, ShaderUniform> | undefined): boolean {
  if (a === b) return true;
  const ka = Object.keys(a ?? {});
  if (ka.length !== Object.keys(b ?? {}).length) return false;
  return ka.every((k) => sameUniform(a![k], b?.[k]));
}

function sameUniform(a: ShaderUniform, b: ShaderUniform | undefined): boolean {
  if (typeof a === 'number' || b === undefined || typeof b === 'number') return a === b;
  if ('id' in a || 'id' in b) return 'id' in a && 'id' in b && a.id === b.id;
  return sameFloats(a, b);
}

function sameMatrix(a: GlMat3 | undefined, b: GlMat3 | undefined): boolean {
  return a === undefined ? b === undefined : b !== undefined && sameFloats(a, b);
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
