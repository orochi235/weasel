import type { TextAlign, TextDirection } from '../textStyle';
import type { BidiResolver } from './bidiSeam';
import { registeredBidi } from './bidiRegistry';
import type { TextShaper } from './shaperSeam';
import { registeredShaper } from './shaperRegistry';
import { DEFAULT_TAB_SIZE } from './tabStops';

/** Options for `layoutRuns`. */
export interface LayoutRunsOpts {
  /** Wrap width. `Infinity` never wraps. */
  maxWidth: number;
  /**
   * Width of the box `center` / `right` resolve within, with `x = 0` its left
   * edge. Default `maxWidth`. Separate from it so a box can align text it does
   * not wrap. When both are infinite a line anchors on its own width instead:
   * `x = 0` is its midpoint (`center`) or right edge (`right`).
   */
  alignWidth?: number;
  lineHeight: number;
  /**
   * `start` / `end` resolve against `direction`; `left` / `right` are absolute
   * and ignore it, the way CSS `text-align` treats the same values. `justify`
   * is `justify: true` with the start edge.
   */
  align: TextAlign;
  /**
   * Spread each line that wrapped across `alignWidth`, widening its word gaps
   * (spaces between words; not leading or hanging trailing ones) by equal
   * shares of the slack. A line that closes its paragraph, or has no gap, or
   * no slack, keeps `align` — so `align` is CSS `text-align-last` here.
   * Implied by `align: 'justify'`. Default `false`.
   */
  justify?: boolean;
  /**
   * Bidi engine. Default: the one given to `registerBidi`. With neither, the
   * text lays out in logical order, which is correct for left-to-right text
   * and wrong for right-to-left text — see the warning this emits when it
   * detects the latter without one.
   */
  bidi?: BidiResolver;
  /**
   * Shaping engine. Default: the one given to `registerShaper`. With neither,
   * each code point is laid out as its own glyph and pairs are kerned, which
   * is wrong for scripts whose letters join or reorder, Arabic and Devanagari
   * among them.
   */
  shaper?: TextShaper;
  /**
   * Reading direction: the base direction of the bidi analysis, and what
   * `start` / `end` resolve against. Default `'auto'`, each paragraph's own
   * first strong character, which only an engine can find: with none, `'auto'`
   * reads left to right.
   */
  direction?: TextDirection | 'auto';
  /**
   * Distance between tab stops, in spaces of the tab's own run (its advance
   * plus the run's tracking), as CSS `tab-size` counts it. A tab advances to
   * the next stop from the start of its line. Default 8.
   */
  tabSize?: number;
}

/** {@link LayoutRunsOpts} with every default filled in. */
export interface ResolvedLayoutOpts {
  maxWidth: number;
  alignWidth: number;
  lineHeight: number;
  align: TextAlign;
  justify: boolean;
  bidi: BidiResolver | null;
  shaper: TextShaper | null;
  direction: TextDirection | 'auto';
  tabSize: number;
}

/** Fill in the defaults `layoutRuns` lays out with: into `out`, when given. */
export function resolveLayoutOpts(
  opts: LayoutRunsOpts,
  out: ResolvedLayoutOpts = {
    maxWidth: 0, alignWidth: 0, lineHeight: 0, align: 'left', justify: false,
    bidi: null, shaper: null, direction: 'auto', tabSize: 0,
  },
): ResolvedLayoutOpts {
  out.maxWidth = opts.maxWidth;
  out.alignWidth = opts.alignWidth ?? opts.maxWidth;
  out.lineHeight = opts.lineHeight;
  out.align = opts.align;
  out.justify = opts.justify === true || opts.align === 'justify';
  out.bidi = layoutBidi(opts);
  out.shaper = layoutShaper(opts);
  out.direction = opts.direction ?? 'auto';
  out.tabSize = opts.tabSize ?? DEFAULT_TAB_SIZE;
  return out;
}

/** The bidi engine `opts` lays out with: its own, else the registered one. */
export function layoutBidi(opts: LayoutRunsOpts): BidiResolver | null {
  return opts.bidi ?? registeredBidi();
}

/** The shaper `opts` lays out with: its own, else the registered one. */
export function layoutShaper(opts: LayoutRunsOpts): TextShaper | null {
  return opts.shaper ?? registeredShaper();
}
