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
import { toHex8, getAlpha01, withAlpha01, mergeAlphaFromPrev, useActionsRegistry } from '@orochi235/weasel';
import type { UiOngoingControl } from '@orochi235/weasel';
// Re-exported for backward compat; ColorContextProvider still imports these
// from here. Remove this block once ColorContextProvider imports from the kit directly.
export { toHex8, getAlpha01, withAlpha01, mergeAlphaFromPrev };
import { useColorContext } from './tools/colorContext';

export type ActivePaint =
  | { kind: 'solid'; color: string }
  | { kind: 'none' }
  | { kind: 'transparent' };

export const DEFAULT_FILL: ActivePaint = { kind: 'solid', color: '#ffffffff' };
export const DEFAULT_STROKE: ActivePaint = { kind: 'solid', color: '#000000ff' };

/** Slice an `#rrggbbaa` color to the 6-char form that
 *  `<input type="color">` accepts as `value`. */
export function toHex6(color: string): string {
  return color.slice(0, 7);
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

function FillColorSwatch(props: {
  fillColor: string;
  fillPrev: string;
  setLocal: (color: string) => void;
}) {
  const actions = useActionsRegistry();
  const ctrlRef = useRef<UiOngoingControl | null>(null);

  function dispatch(v: string, phase: 'input' | 'change' | 'blur'): void {
    if (phase === 'input') {
      if (!ctrlRef.current) {
        ctrlRef.current = actions?.begin('setFill', { color: v }) ?? null;
      } else {
        ctrlRef.current.update({ color: v });
      }
      return;
    }
    // change / blur — commit
    if (ctrlRef.current) {
      ctrlRef.current.update({ color: v });
      ctrlRef.current.end('commit');
      ctrlRef.current = null;
    } else if (phase === 'change') {
      // rare: change without input — begin+end in one shot
      const ctrl = actions?.begin('setFill', { color: v });
      ctrl?.end('commit');
    }
  }

  return (
    <input
      type="color"
      value={props.fillColor}
      onInput={(e) => {
        const v = mergeAlphaFromPrev((e.target as HTMLInputElement).value, props.fillPrev);
        props.setLocal(v);
        dispatch(v, 'input');
      }}
      onChange={(e) => {
        const v = mergeAlphaFromPrev(e.target.value, props.fillPrev);
        props.setLocal(v);
        dispatch(v, 'change');
      }}
      onBlur={() => {
        dispatch(props.fillColor, 'blur');
      }}
      className="wd-swatch-input"
      aria-label="Fill color"
    />
  );
}

function StrokeColorSwatch(props: {
  strokeColor: string;
  strokePrev: string;
  setLocal: (color: string) => void;
}) {
  const actions = useActionsRegistry();
  const ctrlRef = useRef<UiOngoingControl | null>(null);

  function dispatch(v: string, phase: 'input' | 'change' | 'blur'): void {
    if (phase === 'input') {
      if (!ctrlRef.current) {
        ctrlRef.current = actions?.begin('setStroke', { color: v }) ?? null;
      } else {
        ctrlRef.current.update({ color: v });
      }
      return;
    }
    // change / blur — commit
    if (ctrlRef.current) {
      ctrlRef.current.update({ color: v });
      ctrlRef.current.end('commit');
      ctrlRef.current = null;
    } else if (phase === 'change') {
      // rare: change without input — begin+end in one shot
      const ctrl = actions?.begin('setStroke', { color: v });
      ctrl?.end('commit');
    }
  }

  return (
    <input
      type="color"
      value={props.strokeColor}
      onInput={(e) => {
        const v = mergeAlphaFromPrev((e.target as HTMLInputElement).value, props.strokePrev);
        props.setLocal(v);
        dispatch(v, 'input');
      }}
      onChange={(e) => {
        const v = mergeAlphaFromPrev(e.target.value, props.strokePrev);
        props.setLocal(v);
        dispatch(v, 'change');
      }}
      onBlur={() => {
        dispatch(props.strokeColor, 'blur');
      }}
      className="wd-swatch-input"
      aria-label="Stroke color"
    />
  );
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
          <StrokeColorSwatch
            strokeColor={strokeColor}
            strokePrev={strokePrev}
            setLocal={(v) => colors.setStroke({ kind: 'solid', color: v })}
          />
        </button>
        <button
          type="button"
          className={`wd-swatch wd-swatch--fill${colors.focused === 'fill' ? ' is-focused' : ''}${paintClassSuffix(colors.fill)}`}
          style={swatchStyle(colors.fill)}
          title="Fill — click to pick · shift-click for none"
          onClick={(e) => onSwatchClick('fill', e)}
        >
          <FillColorSwatch
            fillColor={fillColor}
            fillPrev={fillPrev}
            setLocal={(v) => colors.setFill({ kind: 'solid', color: v })}
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
