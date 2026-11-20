import type { Flat, Vec } from './flat';

/**
 * The line through `about` whose direction, measured in the plane `basis`
 * spans (as an angle from `basis[0]` toward `basis[1]`), is the multiple of
 * `step` nearest the direction from `about` to `toward`: a constrained
 * gesture's input subspace, in any dimension. `basis` is orthonormal.
 * Throws a `RangeError` for a `step` that is zero or not finite, which has no
 * multiples to hold the direction to.
 */
export function stepLine(about: Vec, toward: Vec, basis: readonly [Vec, Vec], step: number): Flat {
  if (!Number.isFinite(step) || step === 0) throw new RangeError(`stepLine: step must be finite and nonzero, got ${step}`);
  const [u, v] = basis;
  let a = 0;
  let b = 0;
  for (let i = 0; i < about.length; i++) {
    const d = toward[i] - about[i];
    a += d * u[i];
    b += d * v[i];
  }
  const theta = a === 0 && b === 0 ? 0 : Math.round(Math.atan2(b, a) / step) * step;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return { at: about, dirs: [u.map((x, i) => x * c + v[i] * s)] };
}
