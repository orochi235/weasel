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
import { useRef } from 'react';

export type ActivePaint =
  | { kind: 'solid'; color: string }
  | { kind: 'none' }
  | { kind: 'transparent' };

export const DEFAULT_FILL: ActivePaint = { kind: 'solid', color: '#ffffff' };
export const DEFAULT_STROKE: ActivePaint = { kind: 'solid', color: '#000000' };

export interface ActiveSwatchesProps {
  fill: ActivePaint;
  stroke: ActivePaint;
  /** Tracks which swatch the user last interacted with — drives `/` semantics. */
  focused: 'fill' | 'stroke';
  onChangeFill: (next: ActivePaint) => void;
  onChangeStroke: (next: ActivePaint) => void;
  onFocus: (which: 'fill' | 'stroke') => void;
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
  return { ['--swill-swatch-color' as string]: color } as CSSProperties;
}

function paintClassSuffix(p: ActivePaint): string {
  if (p.kind === 'none') return ' is-none';
  if (p.kind === 'transparent') return ' is-transparent';
  return '';
}

export function ActiveSwatches(p: ActiveSwatchesProps) {
  const fillInputRef = useRef<HTMLInputElement>(null);
  const strokeInputRef = useRef<HTMLInputElement>(null);
  const fillColor = p.fill.kind === 'solid' ? p.fill.color : '#ffffff';
  const strokeColor = p.stroke.kind === 'solid' ? p.stroke.color : '#000000';
  const containerClass = `swill-active-swatches${p.compact ? ' swill-active-swatches--compact' : ''}`;
  // Shift-click toggles between solid/none. Plain click opens the color
  // picker. Right-click opens a small menu (none / pick color) — accessible
  // via context-menu key for keyboard users too.
  const onSwatchClick = (which: 'fill' | 'stroke', e: ReactMouseEvent<HTMLButtonElement>): void => {
    e.preventDefault();
    p.onFocus(which);
    if (e.shiftKey) {
      const cur = which === 'fill' ? p.fill : p.stroke;
      const next: ActivePaint = cur.kind === 'none'
        ? { kind: 'solid', color: which === 'fill' ? '#ffffff' : '#000000' }
        : { kind: 'none' };
      if (which === 'fill') p.onChangeFill(next);
      else p.onChangeStroke(next);
      return;
    }
    (which === 'fill' ? fillInputRef : strokeInputRef).current?.click();
  };
  // A small "None" affordance below the pair. Toggles the focused swatch
  // between its current paint and `none`. The icon is the same diagonal-stripe
  // pattern that the swatches use for the `none` state, keeping the visual
  // language consistent.
  const focusedIsNone = (p.focused === 'fill' ? p.fill : p.stroke).kind === 'none';
  const toggleNone = (): void => {
    const cur = p.focused === 'fill' ? p.fill : p.stroke;
    const next: ActivePaint = cur.kind === 'none'
      ? { kind: 'solid', color: p.focused === 'fill' ? '#ffffff' : '#000000' }
      : { kind: 'none' };
    if (p.focused === 'fill') p.onChangeFill(next);
    else p.onChangeStroke(next);
  };
  return (
    <div className="swill-active-swatches-group">
      <div className={containerClass} role="group" aria-label="Active fill and stroke">
        <button
          type="button"
          className={`swill-swatch swill-swatch--stroke${p.focused === 'stroke' ? ' is-focused' : ''}${paintClassSuffix(p.stroke)}`}
          style={swatchStyle(p.stroke)}
          title="Stroke — click to pick · shift-click for none"
          onClick={(e) => onSwatchClick('stroke', e)}
        >
          <input
            ref={strokeInputRef}
            type="color"
            value={strokeColor}
            onChange={(e) => p.onChangeStroke({ kind: 'solid', color: e.target.value })}
            className="swill-swatch-input"
            aria-label="Stroke color"
          />
        </button>
        <button
          type="button"
          className={`swill-swatch swill-swatch--fill${p.focused === 'fill' ? ' is-focused' : ''}${paintClassSuffix(p.fill)}`}
          style={swatchStyle(p.fill)}
          title="Fill — click to pick · shift-click for none"
          onClick={(e) => onSwatchClick('fill', e)}
        >
          <input
            ref={fillInputRef}
            type="color"
            value={fillColor}
            onChange={(e) => p.onChangeFill({ kind: 'solid', color: e.target.value })}
            className="swill-swatch-input"
            aria-label="Fill color"
          />
        </button>
      </div>
      <button
        type="button"
        className={`swill-swatch-none-toggle${focusedIsNone ? ' is-active' : ''}`}
        onClick={toggleNone}
        title={`Toggle none for the focused swatch (${p.focused}) · /`}
        aria-label={`Toggle no paint for ${p.focused}`}
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
