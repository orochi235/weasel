/**
 * Illustrator-style dual swatch widget: active fill on top, active stroke
 * underneath with a small offset overlap. Click either to open a color
 * picker (native `<input type="color">` for v1). `'none'` state renders as
 * a red diagonal stripe across the panel surface.
 *
 * Keybindings (registered by the consumer; not bound here):
 *   D     reset to default — black stroke, white fill
 *   X     swap fill/stroke colors
 *   /     set the last-focused swatch to none
 */
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import { useRef } from 'react';
import { DEFAULT_FILL_COLOR, DEFAULT_STROKE_COLOR, mergeAlphaFromPrev, useActionsRegistry } from '@weasel-js/core';
import type { UiOngoingControl } from '@weasel-js/core';
import { Button } from '@weasel-js/ui';
import { useColorContext } from './tools/colorContext';

export type ActivePaint =
  | { kind: 'solid'; color: string }
  | { kind: 'none' }
  | { kind: 'transparent' };

export const DEFAULT_FILL: ActivePaint = { kind: 'solid', color: DEFAULT_FILL_COLOR };
export const DEFAULT_STROKE: ActivePaint = { kind: 'solid', color: DEFAULT_STROKE_COLOR };

/** Slice an `#rrggbbaa` color to the 6-char form that
 *  `<input type="color">` accepts as `value`. */
export function toHex6(color: string): string {
  return color.slice(0, 7);
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

/** The native picker inside one swatch. Commits on `blur` only — Chrome
 *  fires `change` per tick while the native picker is open (per HTML spec),
 *  which would record one undo entry per tick; `blur` fires once when the
 *  picker closes. */
function SwatchColorInput(props: {
  role: 'fill' | 'stroke';
  color: string;
  prev: string;
  setLocal: (color: string) => void;
}) {
  const actions = useActionsRegistry();
  const ctrlRef = useRef<UiOngoingControl | null>(null);
  const actionId = props.role === 'fill' ? 'setFill' : 'setStroke';

  function input(v: string): void {
    if (!ctrlRef.current) {
      ctrlRef.current = actions?.begin(actionId, { color: v }) ?? null;
    } else {
      ctrlRef.current.update({ color: v });
    }
  }

  function commit(): void {
    if (ctrlRef.current) {
      ctrlRef.current.end('commit');
      ctrlRef.current = null;
    }
  }

  return (
    <input
      type="color"
      value={props.color}
      onInput={(e) => {
        const v = mergeAlphaFromPrev((e.target as HTMLInputElement).value, props.prev);
        props.setLocal(v);
        input(v);
      }}
      onBlur={commit}
      className="wd-swatch-input"
      aria-label={props.role === 'fill' ? 'Fill color' : 'Stroke color'}
    />
  );
}

export function ActiveSwatches() {
  const colors = useColorContext();
  const fillColor = colors.fill.kind === 'solid' ? toHex6(colors.fill.color) : '#ffffff';
  const strokeColor = colors.stroke.kind === 'solid' ? toHex6(colors.stroke.color) : '#000000';
  const fillPrev = colors.fill.kind === 'solid' ? colors.fill.color : DEFAULT_FILL_COLOR;
  const strokePrev = colors.stroke.kind === 'solid' ? colors.stroke.color : DEFAULT_STROKE_COLOR;
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
        ? { kind: 'solid', color: which === 'fill' ? DEFAULT_FILL_COLOR : DEFAULT_STROKE_COLOR }
        : { kind: 'none' };
      if (which === 'fill') colors.setFill(next);
      else colors.setStroke(next);
    }
  };
  const focusedIsNone = (colors.focused === 'fill' ? colors.fill : colors.stroke).kind === 'none';
  return (
    <div className="wd-active-swatches-group">
      <div className="wd-active-swatches" role="group" aria-label="Active fill and stroke">
        <button
          type="button"
          className={`wd-swatch wd-swatch--stroke${colors.focused === 'stroke' ? ' is-focused' : ''}${paintClassSuffix(colors.stroke)}`}
          style={swatchStyle(colors.stroke)}
          title="Stroke — click to pick · shift-click for none"
          onClick={(e) => onSwatchClick('stroke', e)}
        >
          <SwatchColorInput
            role="stroke"
            color={strokeColor}
            prev={strokePrev}
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
          <SwatchColorInput
            role="fill"
            color={fillColor}
            prev={fillPrev}
            setLocal={(v) => colors.setFill({ kind: 'solid', color: v })}
          />
        </button>
      </div>
      <span title={`Toggle none for the focused swatch (${colors.focused}) · /`}>
        <Button
          variant="ghost"
          size="sm"
          pressed={focusedIsNone}
          onClick={colors.toggleFocusedNone}
          ariaLabel={`Toggle no paint for ${colors.focused}`}
        >
          None
        </Button>
      </span>
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
