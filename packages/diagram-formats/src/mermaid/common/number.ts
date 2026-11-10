/** A number as the Mermaid chart kinds write one. */
import { lineError } from '../../lineError';

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

/** `text` as a number; `undefined` for text that is not one, or one too large to hold, which would write back as
 *  `Infinity`. */
export function mermaidNumber(text: string): number | undefined {
  if (!NUMBER.test(text)) return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

/** `text` as a number. Throws, naming `line`, on text {@link mermaidNumber} does not read. */
export function numberAt(text: string, line: number): number {
  const n = mermaidNumber(text);
  if (n === undefined) throw lineError('Mermaid', line, `"${text}" is not a number`);
  return n;
}
