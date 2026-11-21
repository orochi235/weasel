import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { LONG_PRESS_MS, pastDragThreshold } from '@weasel-js/gestures';
import { useLocale } from 'react-aria';
import { useKitSetting } from '@weasel-js/react';
import { blockFrame, realRect } from '../../overlays/blockFrame';
import s from './Select.module.css';

export type Nudge = { offset: number; crossOffset: number };

/** Where and when the pointer went down on the trigger. */
export type Press = { x: number; y: number; at: number };

export const NO_NUDGE: Nudge = { offset: 0, crossOffset: 0 };

/** The gap kept between a list and the viewport edge — React Aria's own
 *  `containerPadding` default. */
const EDGE = 12;

/** React Aria's own resting place for a popover: hanging under its trigger. */
export const BELOW: Nudge = { offset: 8, crossOffset: 0 };

/**
 * Lands the list so its selected row covers the trigger: same text column,
 * same line. The shift is handed back as the popover's own `offset` and
 * `crossOffset` rather than a transform, so React Aria keeps owning the
 * position and still holds the list inside the viewport.
 *
 * Measuring needs the list rendered, and the correction is applied by setting
 * state from a layout effect — React finishes that pass before the browser
 * paints, so the list is never seen at the uncorrected position.
 */
export function AlignOverTrigger({
  triggerRef,
  pressRef,
  applied,
  onMeasure,
}: {
  triggerRef: RefObject<HTMLButtonElement | null>;
  pressRef: RefObject<Press | null>;
  applied: Nudge;
  onMeasure: (next: Nudge) => void;
}) {
  // React Aria positions the popover but hands out no ref to it, so the
  // element is reached from inside: this marker's own parent.
  const markerRef = useRef<HTMLSpanElement>(null);
  const dragPx = useKitSetting('gestures.dragPx');
  const holdMs = useKitSetting('gestures.longPressMs') ?? LONG_PRESS_MS;
  // A measurement that settles takes two passes — one to place the list, one
  // to confirm. A cap is what keeps a list whose own placement changes its
  // measurement from renegotiating forever.
  const passes = useRef(0);
  const { direction } = useLocale();
  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const popover = markerRef.current?.closest<HTMLElement>('[data-weasel-overlay]');
    if (!trigger || !popover || passes.current > 3) return;
    const value = trigger.querySelector(`.${s.value}`);
    // Nothing chosen yet, so there is no row that belongs over the trigger —
    // and putting an arbitrary one under the pointer arms it. A select showing
    // its placeholder hangs its list below, like any other dropdown.
    const label = popover.querySelector(`[data-selected] .${s.optionLabel}`);
    if (!value || !label) {
      delete popover.dataset.align;
      if (applied.offset !== BELOW.offset || applied.crossOffset !== BELOW.crossOffset)
        onMeasure(BELOW);
      return;
    }

    // The trigger's own text alignment decides which edge the two labels are
    // matched on, and the list follows it so the selected row reads as the
    // trigger with the others unfolded around it.
    const style = getComputedStyle(trigger);
    const align = style.getPropertyValue('--wzl-select-align').trim();
    const rtlText = style.direction === 'rtl';
    const toRight = align === 'right' || (align === 'end' && !rtlText) || ((align === 'start' || align === '') && rtlText);
    popover.dataset.align = toRight !== rtlText ? 'end' : 'start';

    // Stated against each element's own box rather than measured as a gap to
    // close: React Aria repositions after this effect, so what is on screen
    // now is a frame behind, and a correction read off it would be applied to
    // a position that has already moved — the shift compounds every pass.
    // `bottom start` puts the list's top at the trigger's bottom and their
    // start edges together, the start read from the locale as React Aria reads it.
    const box = popover.getBoundingClientRect();
    const seat = trigger.getBoundingClientRect();
    const row = label.getBoundingClientRect();
    const shown = value.getBoundingClientRect();
    // Measured in client px, applied in the px of the box the list is drawn in,
    // which a `transform: scale()` or `zoom` above it makes differ.
    const { scaleX, scaleY } = blockFrame(popover);
    // React Aria holds the list inside the viewport across the trigger but not
    // along it, and `offset` moves it along: the selected row sits on the
    // trigger only as far as the rest of the list still fits on screen. A list
    // placed in an overlay frame is held to the frame's part of the viewport.
    const frame = popover.closest('[data-weasel-overlay-frame]');
    const view = frame ? realRect(frame) : { top: 0, bottom: trigger.ownerDocument.documentElement.clientHeight };
    const over = shown.top + shown.height / 2 - seat.top - (row.top + row.height / 2 - box.top) - seat.height;
    const lowest = view.bottom - EDGE * scaleY - box.height - seat.bottom;
    const highest = view.top + EDGE * scaleY - seat.bottom;
    const next = {
      offset: Math.max(highest, Math.min(over, lowest)) / scaleY,
      crossOffset: ((toRight ? shown.right - (row.right - box.left) : shown.left - (row.left - box.left))
        - (direction === 'rtl' ? seat.right - box.width : seat.left)) / scaleX,
    };
    if (Math.abs(next.offset - applied.offset) < 0.5 && Math.abs(next.crossOffset - applied.crossOffset) < 0.5)
      return;
    passes.current += 1;
    onMeasure(next);
  });

  // The list covers the trigger, so the release that ends the click opening it
  // lands on a row — and a row selects on release, which shuts the list again
  // before it has been seen. A click is a press and a release in the same
  // place: that one is the opening gesture and belongs to the trigger, and the
  // list keeps every release after it. Press, hold, drag and release still
  // picks a row, which is the gesture a list over its trigger is for.
  useEffect(() => {
    const doc = triggerRef.current?.ownerDocument;
    if (!doc) return;
    const onUp = (e: PointerEvent) => {
      doc.removeEventListener('pointerup', onUp, true);
      const press = pressRef.current;
      if (!press || performance.now() - press.at > holdMs) return;
      if (pastDragThreshold({ clientX: press.x, clientY: press.y }, e, dragPx)) return;
      e.preventDefault();
      e.stopPropagation();
      // Stopped short of the row, the release also misses every document listener waiting for this pointer to
      // lift, the trigger's own press among them: tell them it is over.
      doc.dispatchEvent(new PointerEvent('pointercancel', { pointerId: e.pointerId, pointerType: e.pointerType, bubbles: true }));
    };
    doc.addEventListener('pointerup', onUp, true);
    return () => doc.removeEventListener('pointerup', onUp, true);
  }, [triggerRef, pressRef, dragPx, holdMs]);

  return <span ref={markerRef} hidden />;
}
