/**
 * Wrap-aware text measurement. Greedy word-wrap against `maxWidth` using
 * `ctx.measureText`. Lines explicitly broken by `\n` are preserved; long
 * single words that exceed `maxWidth` are emitted on their own line without
 * mid-word breaking (caller can decide to clip).
 *
 * Returns the laid-out lines and the total block height in world units
 * (`lines.length * fontSize * lineHeight`). The caller owns the `ctx.font`
 * setup — pass a context whose `font` already matches `style` (use
 * `fontString(style)`).
 */

import type { ResolvedTextStyle } from './textStyle';

export interface MeasuredText {
  lines: string[];
  height: number;
}

export function measureText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  style: ResolvedTextStyle,
): MeasuredText {
  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }
    const words = paragraph.split(/(\s+)/).filter((w) => w.length > 0);
    let current = '';
    for (const word of words) {
      const candidate = current + word;
      if (current === '' || ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current.trimEnd());
        current = /^\s+$/.test(word) ? '' : word;
      }
    }
    lines.push(current.trimEnd());
  }

  const height = lines.length * style.fontSize * style.lineHeight;
  return { lines, height };
}
