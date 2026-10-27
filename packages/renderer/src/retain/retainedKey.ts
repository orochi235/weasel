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
