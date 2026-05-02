/**
 * Typography for `TextPose` and friends. Every field is optional; consumers
 * pass `{}` or override the few they care about. Defaults live in
 * `DEFAULT_TEXT_STYLE` and are applied at render/measure time, never written
 * back to the pose.
 *
 * `color` is provisional: it will be replaced by `fill: Paint` (and likely
 * `stroke?: Stroke`) once the broader paint/stroke story covers text. Keep
 * the per-glyph paint anchoring questions out of v1.
 */

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
  /** Provisional: will become `fill: Paint`. Default `'#000'`. */
  color?: string;
}

export interface ResolvedTextStyle {
  fontSize: number;
  fontFamily: string;
  fontWeight: number | string;
  fontStyle: 'normal' | 'italic';
  align: 'left' | 'center' | 'right';
  lineHeight: number;
  color: string;
}

export const DEFAULT_TEXT_STYLE: ResolvedTextStyle = {
  fontSize: 16,
  fontFamily: 'sans-serif',
  fontWeight: 400,
  fontStyle: 'normal',
  align: 'left',
  lineHeight: 1.2,
  color: '#000',
};

export function resolveTextStyle(style?: TextStyle): ResolvedTextStyle {
  if (!style) return DEFAULT_TEXT_STYLE;
  return {
    fontSize: style.fontSize ?? DEFAULT_TEXT_STYLE.fontSize,
    fontFamily: style.fontFamily ?? DEFAULT_TEXT_STYLE.fontFamily,
    fontWeight: style.fontWeight ?? DEFAULT_TEXT_STYLE.fontWeight,
    fontStyle: style.fontStyle ?? DEFAULT_TEXT_STYLE.fontStyle,
    align: style.align ?? DEFAULT_TEXT_STYLE.align,
    lineHeight: style.lineHeight ?? DEFAULT_TEXT_STYLE.lineHeight,
    color: style.color ?? DEFAULT_TEXT_STYLE.color,
  };
}

/** Build a CSS `font` shorthand suitable for `ctx.font`. */
export function fontString(s: ResolvedTextStyle): string {
  return `${s.fontStyle} ${s.fontWeight} ${s.fontSize}px ${s.fontFamily}`;
}
