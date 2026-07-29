/**
 * Wrap-aware text measurement. Greedy word-wrap against `maxWidth` using
 * `ctx.measureText`. Lines explicitly broken by `\n` are preserved; long
 * single words that exceed `maxWidth` are emitted on their own line without
 * mid-word breaking (caller can decide to clip).
 *
 * Returns the laid-out lines, the total block height in world units
 * (`lines.length * fontSize * lineHeight`), and per-line `lineStarts` —
 * the offset of each line's first character in the original `text`. The
 * starts are used by `caretIndexAt` to map a clicked (x, y) back to a
 * character offset in the source string. Trailing whitespace consumed by
 * the wrap is not included in `lines[i]` but is implicit in the gap
 * between `lineStarts[i] + lines[i].length` and `lineStarts[i + 1]`.
 *
 * The caller owns the `ctx.font` setup — pass a context whose `font`
 * already matches `style` (use `fontString(style)`).
 */

import type { ResolvedTextStyle } from './textStyle';

/** Result of `measureText`: wrapped lines, per-line source offsets, and total block height. */
export interface MeasuredText {
  lines: string[];
  lineStarts: number[];
  height: number;
}

/** Greedy word-wrap text measurement against `maxWidth`; preserves explicit `\n` breaks. */
export function measureText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  style: ResolvedTextStyle,
): MeasuredText {
  const lines: string[] = [];
  const lineStarts: number[] = [];
  const paragraphs = text.split('\n');

  let pos = 0;
  for (let pi = 0; pi < paragraphs.length; pi++) {
    if (pi > 0) pos += 1; // step past the '\n' between paragraphs
    const paragraph = paragraphs[pi];
    if (paragraph === '') {
      lines.push('');
      lineStarts.push(pos);
      continue;
    }
    const words = paragraph.split(/(\s+)/).filter((w) => w.length > 0);
    let current = '';
    let currentStart = pos;
    let consumed = 0; // chars of `paragraph` we've already accounted for
    for (const word of words) {
      if (current === '') currentStart = pos + consumed;
      const candidate = current + word;
      // TODO: this wraps without tracking. `letter-spacing` is not part of the
      // CSS `font` shorthand, so the caller's `ctx.font = fontString(style)`
      // never carries it, and `style.letterSpacing` is used below for `height`
      // but not here — while `layoutRuns` (the GL path that actually paints)
      // counts tracking toward the wrap decision. So tracked text wraps at
      // different points in the two paths, which shows up as `caretIndexAt`
      // landing on the wrong line and `fitTextPose({ axis: 'both' })`
      // under-sizing. Fixing it means adding `candidate.length * tracking`
      // here and to `fitTextPose`'s own width loop; deferred because this
      // function is shared with `verticalAlign` / `markdownText` and the
      // change moves every wrap point on tracked text at once.
      if (current === '' || ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current.trimEnd());
        lineStarts.push(currentStart);
        if (/^\s+$/.test(word)) {
          current = '';
        } else {
          current = word;
          currentStart = pos + consumed;
        }
      }
      consumed += word.length;
    }
    lines.push(current.trimEnd());
    lineStarts.push(currentStart);
    pos += paragraph.length;
  }

  const height = lines.length * style.fontSize * style.lineHeight;
  return { lines, lineStarts, height };
}
