import { useState, type ReactElement } from 'react';
import type { FillStyle } from '@weasel-js/core';
import { paintPreviewCss } from '../../paintPreview';
import { solidColorOf } from '../paintValue';
import { Button } from '../Button';
import type { PaintSlot } from '../GradientEditor';
import s from './FillStrokeSwatch.module.css';

/** Props for {@link FillStrokeSwatch}. */
export interface FillStrokeSwatchProps {
  /** `null` is an explicit "no paint". */
  fill: FillStyle | null | undefined;
  stroke: FillStyle | null | undefined;
  /** The slot that edits aimed at "the current paint" land on — the None
   *  button, a palette click, a keyboard shortcut the app binds. */
  focused: PaintSlot;
  onFocusChange: (slot: PaintSlot) => void;
  /** Every tick of the color picker, as `#rrggbb`. */
  onInput?: (slot: PaintSlot, color: string) => void;
  /** Once when the picker closes, with its last color, if it moved. */
  onChange: (slot: PaintSlot, color: string) => void;
  /** Toggle a slot between no paint and a paint. Given, it adds the None
   *  button (acting on `focused`) and shift-click on a chip. */
  onToggleNone?: (slot: PaintSlot) => void;
  /** Given, adds a Swap button that exchanges the two paints. */
  onSwap?: () => void;
  /** Given, adds a Default button that restores the app's default pair. */
  onReset?: () => void;
  /** Key hints for the buttons' tooltips. The app binds the keys itself. */
  shortcuts?: { none?: string; swap?: string; reset?: string };
  'aria-label'?: string;
  className?: string;
}

const SLOT_LABEL: Record<PaintSlot, string> = { fill: 'Fill', stroke: 'Stroke' };
const PICKER_FALLBACK: Record<PaintSlot, string> = { fill: '#ffffff', stroke: '#000000' };

function Chip(props: {
  slot: PaintSlot;
  paint: FillStyle | null | undefined;
  focused: boolean;
  onFocusChange: (slot: PaintSlot) => void;
  onInput?: (slot: PaintSlot, color: string) => void;
  onChange: (slot: PaintSlot, color: string) => void;
  onToggleNone?: (slot: PaintSlot) => void;
}): ReactElement {
  const { slot, paint, focused } = props;
  // Tracks the picker through a pick; the prop only catches up on commit.
  const [draft, setDraft] = useState<string | null>(null);
  const none = paint === null;
  const preview = paintPreviewCss(paint);
  const pickerValue = (solidColorOf(paint) ?? PICKER_FALLBACK[slot]).slice(0, 7);

  return (
    <span
      className={s.chip}
      data-slot={slot}
      {...(focused ? { 'data-focused': '' } : {})}
      {...(none ? { 'data-none': '' } : {})}
    >
      <span className={s.well} aria-hidden="true">
        {preview && <span className={s.paint} style={{ background: preview }} />}
      </span>
      <input
        type="color"
        className={s.input}
        value={draft ?? pickerValue}
        aria-label={SLOT_LABEL[slot]}
        aria-current={focused ? 'true' : undefined}
        onFocus={() => props.onFocusChange(slot)}
        onClick={(e) => {
          props.onFocusChange(slot);
          // Shift-click is the none toggle; preventing it keeps the OS picker shut.
          if (e.shiftKey && props.onToggleNone) {
            e.preventDefault();
            props.onToggleNone(slot);
          }
        }}
        onInput={(e) => {
          const color = (e.target as HTMLInputElement).value;
          setDraft(color);
          props.onInput?.(slot, color);
        }}
        onBlur={() => {
          if (draft === null) return;
          setDraft(null);
          props.onChange(slot, draft);
        }}
      />
    </span>
  );
}

/**
 * The active fill and stroke as one overlapping pair, the way drawing apps
 * show the paint the next shape gets: fill a solid square behind, stroke a
 * frame in front of it. Each chip is a native color picker; the focused one
 * is what the None button — and whatever the app binds — acts on.
 *
 * Holds no state of its own: the paints and the focused slot are props, and
 * the chips report picks through `onInput`/`onChange` for the app to route —
 * into its own active-paint state, into the selection through
 * `useOngoingAction`, or both.
 */
export function FillStrokeSwatch(props: FillStrokeSwatchProps): ReactElement {
  const {
    fill, stroke, focused, onFocusChange, onInput, onChange,
    onToggleNone, onSwap, onReset, shortcuts, className,
  } = props;
  const focusedPaint = focused === 'fill' ? fill : stroke;
  const chip = { onFocusChange, onInput, onChange, onToggleNone };
  const anyButton = onToggleNone || onSwap || onReset;

  return (
    <div
      className={[s.root, className].filter(Boolean).join(' ')}
      role="group"
      aria-label={props['aria-label'] ?? 'Fill and stroke'}
    >
      <div className={s.pair}>
        <Chip slot="fill" paint={fill} focused={focused === 'fill'} {...chip} />
        <Chip slot="stroke" paint={stroke} focused={focused === 'stroke'} {...chip} />
      </div>
      {anyButton && (
        <div className={s.buttons}>
          {onToggleNone && (
            <Button
              variant="ghost"
              size="sm"
              pressed={focusedPaint === null}
              onClick={() => onToggleNone(focused)}
              shortcut={shortcuts?.none}
            >
              None
            </Button>
          )}
          {onSwap && (
            <Button variant="ghost" size="sm" onClick={onSwap} shortcut={shortcuts?.swap}>
              Swap
            </Button>
          )}
          {onReset && (
            <Button variant="ghost" size="sm" onClick={onReset} shortcut={shortcuts?.reset}>
              Default
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
