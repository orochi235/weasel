import type { CSSProperties } from 'react';

/** Splits a CSS value on top-level whitespace, keeping `calc(1px + 2px)` whole. */
function tokens(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of value.trim()) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * A badge's `padding` prop as the per-side custom properties its stylesheet pads from. The
 * sides have to be apart: a removable badge's label reaches into each one by its own amount.
 * A value that is not a one-to-four part shorthand is set as plain `padding`.
 */
export function paddingStyle(padding: number | string | undefined): CSSProperties {
  if (padding === undefined) return {};
  const parts = typeof padding === 'number' ? [`${padding}px`] : tokens(padding);
  if (parts.length < 1 || parts.length > 4) return { padding };
  const [top, right = top, bottom = top, left = right] = parts;
  return {
    ['--badge-pad-top' as never]: top,
    ['--badge-pad-right' as never]: right,
    ['--badge-pad-bottom' as never]: bottom,
    ['--badge-pad-left' as never]: left,
  };
}
