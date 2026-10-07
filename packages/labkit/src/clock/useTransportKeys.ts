import { useLatest } from '@weasel-js/core';
import { type RefObject, useEffect } from 'react';
import type { TransportControl } from './transportControl';

/** A press on one of these is the control's own: Space clicks a button and
 *  the arrows move a slider. */
const OWNS_KEYS =
  'input, textarea, select, button, [role="slider"], [contenteditable=""], [contenteditable="true"]';

/** The share of a pass an arrow key moves the playhead. */
const ARROW_STEP = 0.05;

/**
 * Space plays and pauses, the arrows step the playhead, Home and End jump to
 * the pass's ends, R flips the direction and `<` / `>` step the speed — on the
 * document `anchor` is in, while `enabled`. `touch` is called before each.
 */
export function useTransportKeys(
  anchor: RefObject<HTMLElement | null>,
  control: TransportControl | null,
  enabled: boolean,
  touch: () => void,
): void {
  const latest = useLatest({ control, touch });
  useEffect(() => {
    const doc = anchor.current?.ownerDocument;
    if (!enabled || !doc) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      const { control: c, touch: touched } = latest.current;
      if (!c || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof Element && event.target.closest(OWNS_KEYS)) return;
      const act = keyAction(event.key, c);
      if (!act) return;
      event.preventDefault();
      touched();
      act();
    };
    doc.addEventListener('keydown', onKeyDown);
    return () => doc.removeEventListener('keydown', onKeyDown);
  }, [anchor, enabled, latest]);
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
      return () => c.seek(0);
    case 'End':
      return () => c.seek(c.length);
    case 'r':
    case 'R':
      return () => c.setBackward(!c.backward);
    default:
      return null;
  }
}
