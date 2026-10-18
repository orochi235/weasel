import type { Flat, Vec } from './flat';

/**
 * The line through `about` whose direction, measured in the plane `basis`
 * spans (as an angle from `basis[0]` toward `basis[1]`), is the multiple of
 * `step` nearest the direction from `about` to `toward`. A Shift-held
 * gesture's input subspace, in any dimension. `basis` is orthonormal.
 */
export function stepLine(about: Vec, toward: Vec, basis: readonly [Vec, Vec], step: number): Flat {
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
