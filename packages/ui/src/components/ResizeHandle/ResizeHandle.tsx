import { useCallback, useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { openPointerSession, type PointerSession } from '@weasel-js/core';
import s from './ResizeHandle.module.css';

/**
 * Props for {@link ResizeHandle}. `onInput` fires throughout the drag and
 * `onChange` once at the end.
 */
export interface ResizeHandleProps {
  /**
   * Which way the handle *runs*, matching `aria-orientation` on the
   * separator role: a `vertical` handle is a vertical bar between two
   * side-by-side panes and drags horizontally. `horizontal` is the
   * stacked case (a bar between rows, dragged up and down).
   */
  orientation?: 'vertical' | 'horizontal';
  /** Current size of the pane being resized, in pixels. */
  value: number;
  min: number;
  max: number;
  /**
   * Flip the sign of the drag. Panes docked to the *trailing* edge (a
   * right sidebar, a bottom drawer) grow as the pointer moves toward the
   * start of the axis, so they want `invert`. Leading-edge panes don't.
   */
  invert?: boolean;
  /**
   * Fires continuously while dragging and on each keyboard step, always
   * clamped to [min, max]. Drive the live size from this.
   */
  onInput(next: number): void;
  /**
   * Fires once when a drag ends or a keyboard step settles, with the final
   * size. Persist here rather than in `onInput` — one write per gesture
   * instead of one per pointer sample.
   */
  onChange?(next: number): void;
  /**
   * The granularity of `value`. Arrow keys move by one step (Shift by
   * eight), and pointer drags snap to the same grid — a pointer reports
   * fractional coordinates on a scaled display, and nobody wants
   * `362.9453125` in their persisted layout. Set a fractional step for a
   * pane measured in something finer than whole pixels.
   */
  step?: number;
  ariaLabel?: string;
  className?: string;
}

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

/**
 * Snap to the step grid, then clamp. Bounds win over the grid: `min`/`max`
 * are hard limits, so a range that isn't a whole number of steps clips to
 * the bound rather than overshooting it.
 */
function settle(n: number, min: number, max: number, step: number): number {
  const snapped = step > 0 ? Math.round(n / step) * step : n;
  // Re-round to kill the float dust `x / 0.1 * 0.1` leaves behind.
  const precise = Number.isInteger(step) ? snapped : Number(snapped.toFixed(10));
  return clamp(precise, min, max);
}

/**
 * Draggable divider for resizing a pane — the "window splitter" pattern.
 * Owns no size of its own: the consumer holds `value` and applies it
 * (typically as a CSS custom property on the pane), which keeps the handle
 * usable for flex, grid, and absolutely-positioned layouts alike.
 *
 * Keyboard-operable as a matter of course: it's focusable, arrows step by
 * `step` (Shift for a coarse step), Home/End jump to the bounds. A splitter
 * that only responds to a pointer drag strands anyone who can't make one.
 */
export function ResizeHandle(props: ResizeHandleProps) {
  const {
    orientation = 'vertical', value, min, max, invert, onInput, onChange,
    step = 1, ariaLabel, className,
  } = props;

  // The session reads current props rather than the ones the pointerdown
  // closed over, so a bound or a step changed mid-drag takes effect.
  const latest = useRef(props);
  latest.current = props;

  // Drag origin. Measured on pointerdown so every move is measured against
  // the gesture's start rather than the previous sample — accumulating
  // per-sample deltas drifts once the pointer leaves the clamped range.
  const drag = useRef<{ origin: number; startValue: number; last: number } | null>(null);
  const session = useRef<PointerSession | null>(null);
  useEffect(() => () => { session.current?.cancel(); }, []);

  const valueAt = (axis: number): number => {
    const d = drag.current!;
    const p = latest.current;
    const delta = axis - d.origin;
    return settle(d.startValue + (p.invert ? -delta : delta), p.min, p.max, p.step ?? 1);
  };

  const finish = (next: number) => {
    drag.current = null;
    session.current = null;
    latest.current.onChange?.(next);
  };

  const onPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || session.current) return;
    const p = latest.current;
    const vertical = (p.orientation ?? 'vertical') === 'vertical';
    const axisOf = (ev: { clientX: number; clientY: number }) => (vertical ? ev.clientX : ev.clientY);
    drag.current = {
      origin: axisOf(e),
      startValue: p.value,
      last: settle(p.value, p.min, p.max, p.step ?? 1),
    };
    session.current = openPointerSession(e.currentTarget, e, {
      onMove: (ev) => {
        const next = valueAt(axisOf(ev));
        drag.current!.last = next;
        latest.current.onInput(next);
      },
      onEnd: (ev) => { finish(valueAt(axisOf(ev))); },
      // A cancelled resize settles where it was left: `onInput` has already
      // moved the pane there and the consumer owns the value, so abandoning
      // the commit would persist a size the user is no longer looking at.
      onCancel: () => { finish(drag.current!.last); },
    });
    e.preventDefault();
  }, []);

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    const grow = orientation === 'vertical' ? 'ArrowRight' : 'ArrowDown';
    const shrink = orientation === 'vertical' ? 'ArrowLeft' : 'ArrowUp';
    const amount = step * (e.shiftKey ? 8 : 1) * (invert ? -1 : 1);
    let next: number | undefined;
    if (e.key === grow) next = value + amount;
    else if (e.key === shrink) next = value - amount;
    else if (e.key === 'Home') next = invert ? max : min;
    else if (e.key === 'End') next = invert ? min : max;
    if (next === undefined) return;
    e.preventDefault();
    const settled = settle(next, min, max, step);
    onInput(settled);
    onChange?.(settled);
  }, [invert, max, min, onInput, onChange, orientation, step, value]);

  const cls = [s.handle, orientation === 'horizontal' && s.horizontal, className]
    .filter(Boolean).join(' ');

  return (
    <div
      className={cls}
      role="separator"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-orientation={orientation}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    />
  );
}
