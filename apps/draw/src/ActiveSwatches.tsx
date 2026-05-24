/**
 * Illustrator-style dual swatch widget: active fill on top, active stroke
 * underneath with a small offset overlap. Click either to open a color
 * picker (native `<input type="color">` for v1). `'none'` state renders as
 * a white square with a red diagonal stripe.
 *
 * Keybindings (registered by the consumer; not bound here):
 *   D     reset to default — black stroke, white fill
 *   X     swap fill/stroke colors
 *   /     set the last-focused swatch to none
 */
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import { useColorContext } from './tools/colorContext';

export type ActivePaint =
  | { kind: 'solid'; color: string }
  | { kind: 'none' }
  | { kind: 'transparent' };

export const DEFAULT_FILL: ActivePaint = { kind: 'solid', color: '#ffffffff' };
export const DEFAULT_STROKE: ActivePaint = { kind: 'solid', color: '#000000ff' };

// ----------------------------------------------------------------------
// Alpha-aware hex helpers. All stored colors in WeaselDraw are
// `#rrggbbaa`. `<input type="color">` only round-trips the 6-char form,
// so call-sites pad the saved alpha back on when the user picks via the
// native widget.
// ----------------------------------------------------------------------

/** Expand `#rgb` / `#rrggbb` to `#rrggbbaa`. Pads `ff` when no alpha
 *  channel is present. Non-hex inputs (named colors, `rgba(...)`) are
 *  returned unchanged — the kit's renderer accepts arbitrary CSS, and
 *  we only normalize the hex shapes we actually persist. */
export function toHex8(color: string): string {
  if (!color.startsWith('#')) return color;
  const hex = color.slice(1);
  if (hex.length === 3) {
    const r = hex[0], g = hex[1], b = hex[2];
    return `#${r}${r}${g}${g}${b}${b}ff`;
  }
  if (hex.length === 6) return `#${hex}ff`;
  if (hex.length === 8) return color.toLowerCase();
  return color;
}

/** Slice an `#rrggbbaa` color to the 6-char form that
 *  `<input type="color">` accepts as `value`. */
export function toHex6(color: string): string {
  return color.slice(0, 7);
}

/** Return the alpha channel of `color` as 0..1. Defaults to 1 when the
 *  color is not in 8-char hex form. */
export function getAlpha01(color: string): number {
  if (!color.startsWith('#') || color.length !== 9) return 1;
  const a = parseInt(color.slice(7, 9), 16);
  return Number.isFinite(a) ? a / 255 : 1;
}

/** Replace the alpha channel of `color` with `alpha01` (clamped to 0..1).
 *  Expands shorter hex forms first. Pass-through for non-hex inputs. */
export function withAlpha01(color: string, alpha01: number): string {
  const a = Math.max(0, Math.min(1, alpha01));
  const aa = Math.round(a * 255).toString(16).padStart(2, '0');
  const eight = toHex8(color);
  if (!eight.startsWith('#') || eight.length !== 9) return color;
  return `${eight.slice(0, 7)}${aa}`;
}

/** Merge a freshly-picked 6-char color (from `<input type="color">`)
 *  with the previous color's alpha channel. */
export function mergeAlphaFromPrev(picked: string, prev: string): string {
  return withAlpha01(picked, getAlpha01(prev));
}

export interface ActiveSwatchesProps {
  /** Render a smaller variant for use inside a properties panel row.
   *  Default false (full-size, suitable for the tool palette). */
  compact?: boolean;
}

/**
 * Render a swatch's display color as a CSS custom property so the rule
 * itself (background, diagonal-stripe overlay) lives in the stylesheet.
 * This is the only inline-style site allowed by the project rule —
 * per-element dynamic values flow via custom properties, not raw `style`.
 */
function swatchStyle(p: ActivePaint): CSSProperties {
  const color = p.kind === 'solid' ? p.color : '#ffffff';
  return { ['--wd-swatch-color' as string]: color } as CSSProperties;
}

function paintClassSuffix(p: ActivePaint): string {
  if (p.kind === 'none') return ' is-none';
  if (p.kind === 'transparent') return ' is-transparent';
  return '';
}

export function ActiveSwatches(p: ActiveSwatchesProps) {
  const colors = useColorContext();
  const fillColor = colors.fill.kind === 'solid' ? toHex6(colors.fill.color) : '#ffffff';
  const strokeColor = colors.stroke.kind === 'solid' ? toHex6(colors.stroke.color) : '#000000';
  const fillPrev = colors.fill.kind === 'solid' ? colors.fill.color : '#ffffffff';
  const strokePrev = colors.stroke.kind === 'solid' ? colors.stroke.color : '#000000ff';
  const containerClass = `wd-active-swatches${p.compact ? ' wd-active-swatches--compact' : ''}`;
  // Shift-click toggles between solid/none. Plain click updates focus and
  // lets the native color input (which receives the bubbled click) open
  // the OS picker. Calling `preventDefault` on the bubbled event would
  // suppress the picker, so we only do that on the shift-toggle branch.
  const onSwatchClick = (which: 'fill' | 'stroke', e: ReactMouseEvent<HTMLButtonElement>): void => {
    colors.setFocus(which);
    if (e.shiftKey) {
      e.preventDefault();
      const cur = which === 'fill' ? colors.fill : colors.stroke;
      const next: ActivePaint = cur.kind === 'none'
        ? { kind: 'solid', color: which === 'fill' ? '#ffffffff' : '#000000ff' }
        : { kind: 'none' };
      if (which === 'fill') colors.setFill(next);
      else colors.setStroke(next);
    }
  };
  // A small "None" affordance below the pair. Toggles the focused swatch
  // between its current paint and `none`. The icon is the same diagonal-stripe
  // pattern that the swatches use for the `none` state, keeping the visual
  // language consistent.
  const focusedIsNone = (colors.focused === 'fill' ? colors.fill : colors.stroke).kind === 'none';
  const toggleNone = (): void => {
    const cur = colors.focused === 'fill' ? colors.fill : colors.stroke;
    const next: ActivePaint = cur.kind === 'none'
      ? { kind: 'solid', color: colors.focused === 'fill' ? '#ffffffff' : '#000000ff' }
      : { kind: 'none' };
    if (colors.focused === 'fill') colors.setFill(next);
    else colors.setStroke(next);
  };
  return (
    <div className="wd-active-swatches-group">
      <div className={containerClass} role="group" aria-label="Active fill and stroke">
        <button
          type="button"
          className={`wd-swatch wd-swatch--stroke${colors.focused === 'stroke' ? ' is-focused' : ''}${paintClassSuffix(colors.stroke)}`}
          style={swatchStyle(colors.stroke)}
          title="Stroke — click to pick · shift-click for none"
          onClick={(e) => onSwatchClick('stroke', e)}
        >
          <input
            type="color"
            value={strokeColor}
            onChange={(e) => colors.setStroke({ kind: 'solid', color: mergeAlphaFromPrev(e.target.value, strokePrev) })}
            className="wd-swatch-input"
            aria-label="Stroke color"
          />
        </button>
        <button
          type="button"
          className={`wd-swatch wd-swatch--fill${colors.focused === 'fill' ? ' is-focused' : ''}${paintClassSuffix(colors.fill)}`}
          style={swatchStyle(colors.fill)}
          title="Fill — click to pick · shift-click for none"
          onClick={(e) => onSwatchClick('fill', e)}
        >
          <input
            type="color"
            value={fillColor}
            onChange={(e) => colors.setFill({ kind: 'solid', color: mergeAlphaFromPrev(e.target.value, fillPrev) })}
            className="wd-swatch-input"
            aria-label="Fill color"
          />
        </button>
      </div>
      <button
        type="button"
        className={`wd-swatch-none-toggle${focusedIsNone ? ' is-active' : ''}`}
        onClick={toggleNone}
        title={`Toggle none for the focused swatch (${colors.focused}) · /`}
        aria-label={`Toggle no paint for ${colors.focused}`}
        aria-pressed={focusedIsNone}
      >
        None
      </button>
    </div>
  );
}

/** Resolve an `ActivePaint` to the hex/string form used in scene objects.
 *  `none` returns the empty string (caller treats as "skip drawing");
 *  `transparent` returns `'rgba(0,0,0,0)'` (a real paint with zero alpha
 *  — still draws and still hit-tests). */
export function paintToString(p: ActivePaint): string {
  if (p.kind === 'solid') return p.color;
  if (p.kind === 'transparent') return 'rgba(0,0,0,0)';
  return '';
}
