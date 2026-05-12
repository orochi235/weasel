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
import type { CSSProperties } from 'react';
import { useRef } from 'react';

export type ActivePaint =
  | { kind: 'solid'; color: string }
  | { kind: 'none' };

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

export function ActiveSwatches(p: ActiveSwatchesProps) {
  const fillInputRef = useRef<HTMLInputElement>(null);
  const strokeInputRef = useRef<HTMLInputElement>(null);
  const fillColor = p.fill.kind === 'solid' ? p.fill.color : '#ffffff';
  const strokeColor = p.stroke.kind === 'solid' ? p.stroke.color : '#000000';
  return (
    <div className="swill-active-swatches" role="group" aria-label="Active fill and stroke">
      <button
        type="button"
        className={`swill-swatch swill-swatch--stroke${p.focused === 'stroke' ? ' is-focused' : ''}${p.stroke.kind === 'none' ? ' is-none' : ''}`}
        style={swatchStyle(p.stroke)}
        title="Stroke (click to pick)"
        onClick={() => { p.onFocus('stroke'); strokeInputRef.current?.click(); }}
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
        className={`swill-swatch swill-swatch--fill${p.focused === 'fill' ? ' is-focused' : ''}${p.fill.kind === 'none' ? ' is-none' : ''}`}
        style={swatchStyle(p.fill)}
        title="Fill (click to pick)"
        onClick={() => { p.onFocus('fill'); fillInputRef.current?.click(); }}
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
  );
}

/** Resolve an `ActivePaint` to the hex/string form used in scene objects. Empty string = no paint. */
export function paintToString(p: ActivePaint): string {
  return p.kind === 'solid' ? p.color : '';
}
