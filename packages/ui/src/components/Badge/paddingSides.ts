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
  const parts = parse(padding);
  if (parts.length < 1 || parts.length > 4) return { padding };
  const [top, right = top, bottom = top, left = right] = parts;
  return {
    ['--badge-pad-top' as never]: top,
    ['--badge-pad-right' as never]: right,
    ['--badge-pad-bottom' as never]: bottom,
    ['--badge-pad-left' as never]: left,
  };
}

type Length = number | string;

const parse = (value: Length): string[] => (typeof value === 'number' ? [`${value}px`] : tokens(value));

const SIDES = { paddingTop: 'top', paddingRight: 'right', paddingBottom: 'bottom', paddingLeft: 'left' } as const;

/**
 * `style` with its padding moved onto the properties {@link paddingStyle} sets, so padding
 * reaches the label of a removable badge by whichever of the two it was given. A two-part
 * `paddingInline` stays as it is: which side each part pads is the text direction's to say.
 */
export function liftPadding(style: CSSProperties | undefined): CSSProperties {
  if (!style) return {};
  const { padding, paddingBlock, paddingInline, paddingTop, paddingRight, paddingBottom, paddingLeft, ...rest } = style;
  const out: Record<string, Length> = { ...(rest as Record<string, Length>), ...(paddingStyle(padding as Length | undefined) as Record<string, Length>) };
  const set = (side: string, value: string) => { out[`--badge-pad-${side}`] = value; };
  if (paddingBlock !== undefined) {
    const [top, bottom = top] = parse(paddingBlock as Length);
    if (top === undefined) out.paddingBlock = paddingBlock as Length;
    else { set('top', top); set('bottom', bottom); }
  }
  if (paddingInline !== undefined) {
    const parts = parse(paddingInline as Length);
    if (parts.length !== 1) out.paddingInline = paddingInline as Length;
    else { set('left', parts[0]); set('right', parts[0]); }
  }
  const sides = { paddingTop, paddingRight, paddingBottom, paddingLeft };
  for (const [prop, side] of Object.entries(SIDES) as [keyof typeof SIDES, string][]) {
    const value = sides[prop];
    if (value !== undefined) set(side, parse(value as Length).join(' '));
  }
  return out as CSSProperties;
}
