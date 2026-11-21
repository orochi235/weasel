import { useRef, useState, type ReactElement } from 'react';
import { paintPreviewCss, type PaintSlot, type Paint } from '@weasel-js/paint';
import { Button } from '../Button';
import type { HoldProps } from '../Disabled';
import { useControlHold, type ButtonHoldAttrs } from '../Disabled/controlHold';
import { PaintEditorPopover } from '../PaintField/PaintEditorPopover';
import { useOverlayPortal, type OverlayPortalProps } from '../../overlays/portalHost';
import s from './FillStrokeSwatch.module.css';

/** Props for {@link FillStrokeSwatch}. Disabled, by its own props or a scope, it takes no press; read-only, its chips
 *  still pick the target and every paint change is refused. */
export interface FillStrokeSwatchProps extends OverlayPortalProps, HoldProps {
  /** `null` is an explicit "no paint". */
  fill: Paint | null | undefined;
  stroke: Paint | null | undefined;
  /** The slot that edits aimed at "the current paint" land on — the None
   *  button, a palette click, a keyboard shortcut the app binds. */
  target: PaintSlot;
  onTargetChange: (slot: PaintSlot) => void;
  /** Every tick of an edit in a chip's paint editor. `null` is no paint. */
  onInput?: (slot: PaintSlot, paint: Paint | null) => void;
  /** Once per edit in a chip's paint editor. Return the paint actually
   *  applied when it differs from the editor's, and the recent colors record
   *  its color instead. */
  onChange: (slot: PaintSlot, paint: Paint | null) => Paint | null | void;
  /** Toggle a slot between no paint and a paint. Given, it adds the None
   *  button (acting on `target`) and shift-click on a chip. */
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
  targeted: boolean;
  portalContainer?: Element | null;
  onTargetChange: (slot: PaintSlot) => void;
  onInput?: (slot: PaintSlot, paint: Paint | null) => void;
  onChange: (slot: PaintSlot, paint: Paint | null) => Paint | null | void;
  onToggleNone?: (slot: PaintSlot) => void;
  /** The swatch's hold, as the trigger's attributes and what it refuses. */
  held: { attrs: ButtonHoldAttrs & { 'aria-describedby'?: string }; refuses: boolean; disabled: boolean };
}): ReactElement {
  const { slot, paint, targeted, held } = props;
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const { anchor, provide, ready } = useOverlayPortal(props.portalContainer);
  const none = paint === null;
  const preview = paintPreviewCss(paint);

  return (
    <span
      className={s.chip}
      data-slot={slot}
      {...(targeted ? { 'data-target': '' } : {})}
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
        aria-current={targeted ? 'true' : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        {...held.attrs}
        onFocus={() => { if (!held.disabled) props.onTargetChange(slot); }}
        onClick={(e) => {
          if (held.disabled) return;
          props.onTargetChange(slot);
          if (held.refuses) return;
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
          open={open}
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
 * or a pattern is edited as itself; the target chip is what the None button —
 * and whatever the app binds — acts on.
 *
 * Holds no state of its own: the paints and the target slot are props, and
 * the chips report each `Paint` through `onInput`/`onChange` for the app to route —
 * into its own active-paint state, into the selection through
 * `useOngoingAction`, or both.
 */
export function FillStrokeSwatch(props: FillStrokeSwatchProps): ReactElement {
  const {
    fill, stroke, target, onTargetChange, onInput, onChange,
    onToggleNone, onSwap, onReset, shortcuts, className, portalContainer,
    disabled, disabledReason, readOnly, readOnlyReason,
  } = props;
  const hold = useControlHold({ disabled, disabledReason, readOnly, readOnlyReason }, { readonlyRole: false });
  const held = {
    attrs: { ...hold.button(true), 'aria-describedby': hold.focus['aria-describedby'] },
    refuses: hold.refuses,
    disabled: hold.disabled,
  };
  const targetPaint = target === 'fill' ? fill : stroke;
  const chip = { onTargetChange, onInput, onChange, onToggleNone, portalContainer, held };
  const anyButton = onToggleNone || onSwap || onReset;
  // Read-only refuses Swap and Default as it does the None toggle, which follows it by being pressed.
  const readOnlyButton = hold.access.state === 'readOnly'
    ? { disabled: true, disabledReason: hold.access.reason }
    : {};

  return hold.wrap(
    <div
      className={[s.root, className].filter(Boolean).join(' ')}
      role="group"
      aria-label={props['aria-label'] ?? 'Fill and stroke'}
    >
      <div className={s.pair}>
        <Chip slot="fill" paint={fill} targeted={target === 'fill'} {...chip} />
        <Chip slot="stroke" paint={stroke} targeted={target === 'stroke'} {...chip} />
      </div>
      {anyButton && hold.scope(
        <div className={s.buttons}>
          {onToggleNone && (
            <Button
              variant="ghost"
              size="sm"
              pressed={targetPaint === null}
              onClick={hold.gate(() => onToggleNone(target))}
              shortcut={shortcuts?.none}
            >
              None
            </Button>
          )}
          {onSwap && (
            <Button variant="ghost" size="sm" {...readOnlyButton} onClick={hold.gate(onSwap)} shortcut={shortcuts?.swap}>
              Swap
            </Button>
          )}
          {onReset && (
            <Button variant="ghost" size="sm" {...readOnlyButton} onClick={hold.gate(onReset)} shortcut={shortcuts?.reset}>
              Default
            </Button>
          )}
        </div>,
      )}
    </div>,
  );
}
