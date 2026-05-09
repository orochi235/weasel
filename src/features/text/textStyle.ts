/**
 * Typography for `TextPose` and friends. Every field is optional; consumers
 * pass `{}` or override the few they care about. Defaults live in
 * `DEFAULT_TEXT_STYLE` and are applied at render/measure time, never written
 * back to the pose.
 *
 * `fill` follows the kit-wide `Paint` model — solid color or pattern. The
 * contenteditable edit overlay flattens non-solid fills to `'#000'` for CSS
 * since the browser can't paint with a `CanvasPattern`.
 */

import type { Paint } from '../../core/paint-types';

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
  /** Default `{ fill: 'solid', color: '#000' }`. */
  fill?: Paint;
  /**
   * Caret color used by the edit overlay. Defaults to the text color when
   * `fill` is solid; falls back to `#000` for non-solid paints.
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
}

/** `TextStyle` with all fields filled in from defaults — what the renderer actually consumes. */
export interface ResolvedTextStyle {
  fontSize: number;
  fontFamily: string;
  fontWeight: number | string;
  fontStyle: 'normal' | 'italic';
  align: 'left' | 'center' | 'right';
  lineHeight: number;
  fill: Paint;
  caretColor: string;
  selectionBackground: string | null;
  selectionColor: string | null;
}

const DEFAULT_FILL: Paint = { fill: 'solid', color: '#000' };

function paintColor(p: Paint): string {
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
};

/** Fill in a partial `TextStyle` with defaults from `DEFAULT_TEXT_STYLE`. */
export function resolveTextStyle(style?: TextStyle): ResolvedTextStyle {
  if (!style) return DEFAULT_TEXT_STYLE;
  const fill = style.fill ?? DEFAULT_TEXT_STYLE.fill;
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
  };
}

/** Build a CSS `font` shorthand suitable for `ctx.font`. */
export function fontString(s: ResolvedTextStyle): string {
  return `${s.fontStyle} ${s.fontWeight} ${s.fontSize}px ${s.fontFamily}`;
}
