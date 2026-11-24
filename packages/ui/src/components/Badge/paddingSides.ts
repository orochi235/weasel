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
 * A value that is not a one-to-four part shorthand, or is one `var()` that may hold several parts,
 * is set as plain `padding`.
 */
export function paddingStyle(padding: number | string | undefined): CSSProperties {
  if (padding === undefined) return {};
  const parts = parse(padding);
  if (parts.length < 1 || parts.length > 4 || loneVar(parts)) return { padding };
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

/** Whether `parts` is one `var()`, whose value may be any number of parts. */
const loneVar = (parts: string[]) => parts.length === 1 && /^var\(/i.test(parts[0]);

const SIDES = { paddingTop: 'top', paddingRight: 'right', paddingBottom: 'bottom', paddingLeft: 'left' } as const;

/**
 * `style` with its padding, and the badge's `padding` prop under it, moved onto the properties
 * {@link paddingStyle} sets, so padding reaches the label of a removable badge by whichever of the two
 * it was given. A two-part `paddingInline` stays as it is: which side each part pads is the text
 * direction's to say. A side that a shorthand left as plain padding covers is set as plain padding
 * too, since that shorthand outranks the stylesheet's.
 */
export function liftPadding(style: CSSProperties | undefined, padding?: Length): CSSProperties {
  const { padding: own, paddingBlock, paddingInline, paddingTop, paddingRight, paddingBottom, paddingLeft, ...rest } = style ?? {};
  const out: Record<string, Length> = { ...(rest as Record<string, Length>), ...(paddingStyle((own ?? padding) as Length | undefined) as Record<string, Length>) };
  const plain = new Set<string>(out.padding !== undefined ? ['top', 'right', 'bottom', 'left'] : []);
  const set = (side: string, value: string) => {
    if (plain.has(side)) out[`padding${side[0].toUpperCase()}${side.slice(1)}`] = value;
    else out[`--badge-pad-${side}`] = value;
  };
  if (paddingBlock !== undefined) {
    const parts = parse(paddingBlock as Length);
    const [top, bottom = top] = parts;
    if (top === undefined || loneVar(parts)) {
      out.paddingBlock = paddingBlock as Length;
      plain.add('top').add('bottom');
    } else { set('top', top); set('bottom', bottom); }
  }
  if (paddingInline !== undefined) {
    const parts = parse(paddingInline as Length);
    if (parts.length !== 1 || loneVar(parts)) {
      out.paddingInline = paddingInline as Length;
      plain.add('left').add('right');
    } else { set('left', parts[0]); set('right', parts[0]); }
  }
  const sides = { paddingTop, paddingRight, paddingBottom, paddingLeft };
  for (const [prop, side] of Object.entries(SIDES) as [keyof typeof SIDES, string][]) {
    const value = sides[prop];
    if (value !== undefined) set(side, parse(value as Length).join(' '));
  }
  return out as CSSProperties;
}
