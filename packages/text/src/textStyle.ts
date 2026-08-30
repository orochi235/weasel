/**
 * Typography for `TextPose` and friends. Every field is optional; consumers
 * pass `{}` or override the few they care about. Defaults live in
 * `DEFAULT_TEXT_STYLE` and are applied at render/measure time, never written
 * back to the pose.
 *
 * Paint is not typography and does not live here. A text node carries its
 * fill and stroke in `data.fill` / `data.stroke`, the slots every other node
 * kind uses; `resolveTextStyle` takes them as its second argument and
 * `StyledRun.fill` / `.stroke` override them per range.
 */

import type { FillStyle, Stroke } from '@weasel-js/paint';

/** User-facing text style. All fields optional; defaults applied at render time via `resolveTextStyle`. */
export interface TextStyle {
  /** Font size in world units. Default 16. */
  fontSize?: number;
  /** Default `'sans-serif'`. */
  fontFamily?: string;
  /** Default 400. */
  fontWeight?: number | string;
  /** Default `'normal'`. */
  fontStyle?: 'normal' | 'italic';
  /** Default `'left'`. */
  align?: 'left' | 'center' | 'right';
  /** Multiplier applied to `fontSize`. Default 1.2. */
  lineHeight?: number;
  /**
   * Caret color used by the edit overlay. Defaults to the node's fill when
   * that fill is solid; falls back to `#000` for non-solid paints.
   */
  caretColor?: string;
  /**
   * Selection background color used by the edit overlay's `::selection`
   * pseudo-element. Defaults to a 25%-opacity tint of `caretColor` via CSS
   * `color-mix`. Pass `'none'` to fall back to the browser-native highlight.
   */
  selectionBackground?: string;
  /** Selection text color paired with `selectionBackground`. Default: inherits text color. */
  selectionColor?: string;
  /** Extra advance added after each glyph, in world units. Default 0. */
  letterSpacing?: number;
  /** Default `false`. */
  underline?: boolean;
  /** Default `false`. */
  strikethrough?: boolean;
  /** Default `false`. */
  overline?: boolean;
}

/** `TextStyle` with all fields filled in from defaults — what the renderer actually consumes. */
export interface ResolvedTextStyle {
  fontSize: number;
  fontFamily: string;
  fontWeight: number | string;
  fontStyle: 'normal' | 'italic';
  align: 'left' | 'center' | 'right';
  lineHeight: number;
  fill: FillStyle;
  caretColor: string;
  selectionBackground: string | null;
  selectionColor: string | null;
  letterSpacing: number;
  underline: boolean;
  strikethrough: boolean;
  overline: boolean;
  /** Absent means no outline — unlike the other fields, this one has no
   *  default to fall back to. See {@link TextPaint.stroke}. */
  stroke?: Stroke;
}

const DEFAULT_FILL: FillStyle = { fill: 'solid', color: '#000' };

function paintColor(p: FillStyle): string {
  return 'color' in p ? p.color : '#000';
}

/**
 * Default selection background derived from `textColor` — a 25% tint via
 * CSS `color-mix`. Caller passes `'none'` to opt out.
 */
function defaultSelectionBackground(textColor: string): string {
  return `color-mix(in srgb, ${textColor} 25%, transparent)`;
}

/** Default resolved style used when a `TextPose` omits `style`. */
export const DEFAULT_TEXT_STYLE: ResolvedTextStyle = {
  fontSize: 16,
  fontFamily: 'sans-serif',
  fontWeight: 400,
  fontStyle: 'normal',
  align: 'left',
  lineHeight: 1.2,
  fill: DEFAULT_FILL,
  caretColor: paintColor(DEFAULT_FILL),
  selectionBackground: defaultSelectionBackground(paintColor(DEFAULT_FILL)),
  selectionColor: null,
  letterSpacing: 0,
  underline: false,
  strikethrough: false,
  overline: false,
};

/**
 * The paint a text node hands its glyphs — `data.fill` and `data.stroke`,
 * read straight off the node. Runs inherit these when they name none of
 * their own.
 *
 * `fill: null` is not yet distinguishable from absent: a `ResolvedRun` must
 * name a concrete fill, so unfilled-but-stroked text has nowhere to say so
 * and falls back to the default black. See `docs/TODO.md`.
 */
export interface TextPaint {
  fill?: FillStyle | null;
  /**
   * Outline painted over the glyph fill. Absent means no outline — there is
   * no such thing as a default text stroke.
   *
   * Only glyphs on the outline tier are stroked: above
   * `textOutlineMinScreenSize` a glyph is a real `PolygonPath`, so it gets
   * the ordinary tessellated ribbon with real joins, caps and miters, in any
   * paint. Below it a glyph is a sampled distance field with no geometry to
   * stroke, and it renders unstroked rather than approximated. `width` is in
   * world units, like every other stroke in the kit — it does not scale with
   * `fontSize`.
   */
  stroke?: Stroke | null;
}

/** Fill in a partial `TextStyle` with defaults from `DEFAULT_TEXT_STYLE`,
 *  taking the glyph paint from the node rather than from the style. */
export function resolveTextStyle(
  style?: TextStyle,
  paint?: TextPaint,
): ResolvedTextStyle {
  const fill = paint?.fill ?? DEFAULT_TEXT_STYLE.fill;
  const stroke = paint?.stroke ?? undefined;
  if (!style) {
    return fill === DEFAULT_TEXT_STYLE.fill && stroke === undefined
      ? DEFAULT_TEXT_STYLE
      : {
        ...DEFAULT_TEXT_STYLE,
        fill,
        caretColor: paintColor(fill),
        selectionBackground: defaultSelectionBackground(paintColor(fill)),
        ...(stroke !== undefined ? { stroke } : {}),
      };
  }
  const caretColor = style.caretColor ?? paintColor(fill);
  let selectionBackground: string | null;
  if (style.selectionBackground === 'none') {
    selectionBackground = null;
  } else if (style.selectionBackground != null) {
    selectionBackground = style.selectionBackground;
  } else {
    selectionBackground = defaultSelectionBackground(caretColor);
  }
  return {
    fontSize: style.fontSize ?? DEFAULT_TEXT_STYLE.fontSize,
    fontFamily: style.fontFamily ?? DEFAULT_TEXT_STYLE.fontFamily,
    fontWeight: style.fontWeight ?? DEFAULT_TEXT_STYLE.fontWeight,
    fontStyle: style.fontStyle ?? DEFAULT_TEXT_STYLE.fontStyle,
    align: style.align ?? DEFAULT_TEXT_STYLE.align,
    lineHeight: style.lineHeight ?? DEFAULT_TEXT_STYLE.lineHeight,
    fill,
    caretColor,
    selectionBackground,
    selectionColor: style.selectionColor ?? null,
    letterSpacing: style.letterSpacing ?? DEFAULT_TEXT_STYLE.letterSpacing,
    underline: style.underline ?? DEFAULT_TEXT_STYLE.underline,
    strikethrough: style.strikethrough ?? DEFAULT_TEXT_STYLE.strikethrough,
    overline: style.overline ?? DEFAULT_TEXT_STYLE.overline,
    ...(stroke !== undefined ? { stroke } : {}),
  };
}

/** Build a CSS `font` shorthand suitable for `ctx.font`. */
export function fontString(s: ResolvedTextStyle): string {
  return `${s.fontStyle} ${s.fontWeight} ${s.fontSize}px ${s.fontFamily}`;
}
