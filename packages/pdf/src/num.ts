/** What `num` throws for NaN or an infinity; `writeCommands` drops the command that wrote one. */
export class NonFiniteNumber extends Error {}

/** A PDF number: at most `decimals` decimals (four unless asked), never an exponent. */
export function num(n: number, decimals = 4): string {
  if (!Number.isFinite(n)) throw new NonFiniteNumber(`pdf: cannot write non-finite number ${n}`);
  // toFixed falls back to exponent form from 1e21.
  if (Math.abs(n) >= 1e21) return BigInt(n).toString();
  const fixed = n.toFixed(Math.min(100, decimals));
  // Only zeros after a point are trailing: a whole number keeps its own.
  const s = fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
  return s === '-0' ? '0' : s;
}
