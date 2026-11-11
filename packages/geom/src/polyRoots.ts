/** The real roots in [0, 1] of the polynomial `Σ c[i] tⁱ`, ascending: isolated between the roots of its
 *  derivative, where it is monotone, then bisected. Roots that touch without crossing are found only where
 *  the polynomial is exactly zero. */
export function polynomialRoots01(c: readonly number[]): number[] {
  let n = c.length - 1;
  while (n > 0 && c[n] === 0) n--;
  if (n <= 0) return [];
  if (n === 1) {
    const t = -c[0]! / c[1]!;
    return t >= 0 && t <= 1 ? [t] : [];
  }
  const at = (t: number): number => {
    let v = 0;
    for (let i = n; i >= 0; i--) v = v * t + c[i]!;
    return v;
  };
  const turns = polynomialRoots01(Array.from({ length: n }, (_, i) => c[i + 1]! * (i + 1)));
  const stops = [0, ...turns.filter((t) => t > 0 && t < 1), 1];
  const out: number[] = [];
  for (let k = 0; k + 1 < stops.length; k++) {
    let lo = stops[k]!, hi = stops[k + 1]!;
    let flo = at(lo);
    const fhi = at(hi);
    if (flo === 0) { out.push(lo); continue; }
    if (fhi === 0 || (flo < 0) === (fhi < 0)) continue;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (mid <= lo || mid >= hi) break;
      const f = at(mid);
      if (f === 0) { lo = hi = mid; break; }
      if ((f < 0) === (flo < 0)) { lo = mid; flo = f; } else hi = mid;
    }
    out.push(lo);
  }
  if (at(1) === 0) out.push(1);
  return out;
}
