/** A PDF number: at most four decimals, never an exponent. */
export function num(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`pdf: cannot write non-finite number ${n}`);
  // toFixed falls back to exponent form from 1e21.
  if (Math.abs(n) >= 1e21) return BigInt(n).toString();
  const s = n.toFixed(4).replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
}
