import { useRef, useState, type ReactElement } from 'react';
import type { Paint } from '@weasel-js/core';
import { paintPreviewCss, type PaintSlot } from '@weasel-js/paint';
import { Button } from '../Button';
import { PaintEditorPopover } from '../PaintField/PaintEditorPopover';
import { useOverlayPortal, type OverlayPortalProps } from '../../overlays/portalHost';
import s from './FillStrokeSwatch.module.css';

/** Props for {@link FillStrokeSwatch}. */
export interface FillStrokeSwatchProps extends OverlayPortalProps {
  /** `null` is an explicit "no paint". */
  fill: Paint | null | undefined;
  stroke: Paint | null | undefined;
  /** The slot that edits aimed at "the current paint" land on — the None
   *  button, a palette click, a keyboard shortcut the app binds. */
  focused: PaintSlot;
  onFocusChange: (slot: PaintSlot) => void;
  /** Every tick of an edit in a chip's paint editor. `null` is no paint. */
  onInput?: (slot: PaintSlot, paint: Paint | null) => void;
  /** Once per edit in a chip's paint editor. Return the paint actually
   *  applied when it differs from the editor's, and the recent colors record
   *  its color instead. */
  onChange: (slot: PaintSlot, paint: Paint | null) => Paint | null | void;
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

function Chip(props: {
  slot: PaintSlot;
  paint: Paint | null | undefined;
  focused: boolean;
  portalContainer?: Element | null;
  onFocusChange: (slot: PaintSlot) => void;
  onInput?: (slot: PaintSlot, paint: Paint | null) => void;
  onChange: (slot: PaintSlot, paint: Paint | null) => Paint | null | void;
  onToggleNone?: (slot: PaintSlot) => void;
}): ReactElement {
  const { slot, paint, focused } = props;
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const { anchor, provide, ready } = useOverlayPortal(props.portalContainer);
  const none = paint === null;
  const preview = paintPreviewCss(paint);

  return (
    <span
      className={s.chip}
      data-slot={slot}
      {...(focused ? { 'data-focused': '' } : {})}
      {...(none ? { 'data-none': '' } : {})}
    >
      {anchor}
      <span className={s.well} aria-hidden="true">
        {preview && <span className={s.paint} style={{ background: preview }} />}
      </span>
      <button
        ref={trigger}
        type="button"
        className={s.trigger}
        aria-label={SLOT_LABEL[slot]}
        aria-current={focused ? 'true' : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        onFocus={() => props.onFocusChange(slot)}
        onClick={(e) => {
          props.onFocusChange(slot);
          // Shift-click is the none toggle, and leaves the editor shut.
          if (e.shiftKey && props.onToggleNone) {
            props.onToggleNone(slot);
            return;
          }
          setOpen(true);
        }}
      />
      {ready && provide(
        <PaintEditorPopover
          triggerRef={trigger}
          isOpen={open}
          onOpenChange={setOpen}
          value={paint}
          aria-label={SLOT_LABEL[slot]}
          onInput={(next) => props.onInput?.(slot, next)}
          onChange={(next) => props.onChange(slot, next)}
        />,
      )}
    </span>
  );
}

/**
 * The active fill and stroke as one overlapping pair, the way drawing apps
 * show the paint the next shape gets: fill a solid square behind, stroke a
 * frame in front of it. Each chip opens the whole paint editor, so a gradient
 * or a pattern is edited as itself; the focused chip is what the None button —
 * and whatever the app binds — acts on.
 *
 * Holds no state of its own: the paints and the focused slot are props, and
 * the chips report each `Paint` through `onInput`/`onChange` for the app to route —
 * into its own active-paint state, into the selection through
 * `useOngoingAction`, or both.
 */
export function FillStrokeSwatch(props: FillStrokeSwatchProps): ReactElement {
  const {
    fill, stroke, focused, onFocusChange, onInput, onChange,
    onToggleNone, onSwap, onReset, shortcuts, className, portalContainer,
  } = props;
  const focusedPaint = focused === 'fill' ? fill : stroke;
  const chip = { onFocusChange, onInput, onChange, onToggleNone, portalContainer };
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
