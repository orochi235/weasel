import { useLatest } from '@weasel-js/core';
import { type RefObject, useEffect } from 'react';
import { useLabCommandsOptional } from '../lab/LabContext';
import type { TransportControl } from './transportControl';

/** A press on one of these is its own: Space clicks a button, the arrows move
 *  a slider, and a canvas has bindings of its own on all of them. */
const OWNS_KEYS =
  'input, textarea, select, button, canvas, [role="slider"], [contenteditable=""], [contenteditable="true"]';

/** The share of a pass an arrow key moves the playhead. */
const ARROW_STEP = 0.05;

/**
 * Space plays and pauses, the arrows step the playhead, Home and End jump to
 * the pass's ends, R flips the direction and `<` / `>` step the speed — on the
 * document `anchor` is in, while `enabled` and while focus is outside a field,
 * a control and a canvas. A transport inside a trial answers keys from that
 * trial, and from outside every trial while its trial is the lab's focused one,
 * as the trial's own chords do.
 */
export function useTransportKeys(
  anchor: RefObject<HTMLElement | null>,
  control: TransportControl | null,
  enabled: boolean,
): void {
  const focusedTrialId = useLabCommandsOptional()?.focusedTrialId ?? null;
  const latest = useLatest({ control, focusedTrialId });
  // The transport renders its anchor only once it has a control, so the
  // listener has to wait for that commit rather than run once without one.
  const ready = control !== null;
  useEffect(() => {
    const doc = anchor.current?.ownerDocument;
    if (!enabled || !ready || !doc) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      const { control: c } = latest.current;
      if (!c || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.isContentEditable) return;
      if (target instanceof Element && target.closest(OWNS_KEYS)) return;
      if (!answersFor(anchor.current, target, latest.current.focusedTrialId)) return;
      const act = keyAction(event.key, c);
      if (!act) return;
      event.preventDefault();
      act();
    };
    doc.addEventListener('keydown', onKeyDown);
    return () => doc.removeEventListener('keydown', onKeyDown);
  }, [anchor, enabled, ready, latest]);
}

const trialOf = (el: unknown): string | null =>
  el instanceof Element
    ? (el.closest('[data-trial-id]')?.getAttribute('data-trial-id') ?? null)
    : null;

/** Whether a transport at `anchor` answers a key at `target`: one outside every trial answers all. */
function answersFor(
  anchor: Element | null,
  target: EventTarget | null,
  focused: string | null,
): boolean {
  const own = trialOf(anchor);
  if (own === null) return true;
  const from = trialOf(target);
  return from === null ? focused === null || focused === own : from === own;
}

function keyAction(key: string, c: TransportControl): (() => void) | null {
  const step = c.length * ARROW_STEP;
  switch (key) {
    case ' ':
      return () => c.toggle();
    case '>':
      return () => c.stepSpeed(1);
    case '<':
      return () => c.stepSpeed(-1);
  }
  if (!c.scrubs) return null;
  switch (key) {
    case 'ArrowRight':
      return () => c.seek(c.playhead + step);
    case 'ArrowLeft':
      return () => c.seek(c.playhead - step);
    case 'Home':
      return () => c.seek(c.start);
    case 'End':
      return () => c.seek(c.start + c.length);
    case 'r':
    case 'R':
      return () => c.setBackward(!c.backward);
    default:
      return null;
  }
}
