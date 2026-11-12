/**
 * The style armed at a collapsed caret for the next character, kept as the change it makes to the styling the
 * caret sits in: a key it sets, and a key it takes off as `false` (a flag) or `undefined`. So a shortcut can take
 * bold off at the end of a bold word, and the character typed next lands as a write of the same patch over it would.
 */
import { useCallback, useRef, useState } from 'react';
import { applyStyleToRange, type RangeStyle, type RunStylePatch } from '@weasel-js/text';

const FLAGS: ReadonlySet<string> = new Set(['bold', 'italic', 'underline', 'strikethrough', 'overline']);

/** `style` with `armed` laid over it, as the next character takes them. */
export function withArmed(style: RunStylePatch, armed: RunStylePatch): RunStylePatch {
  const out: Record<string, unknown> = { ...style };
  for (const [key, value] of Object.entries(armed)) {
    if (value === undefined || value === false) delete out[key];
    else out[key] = value;
  }
  return out as RunStylePatch;
}

/**
 * The armed style after `patch` is armed over `armed` at a caret whose character would take `caret`: the change from
 * `caret` to what a write of `patch` leaves on the next character. Empty when that is `caret` itself.
 */
export function armPatch(caret: RunStylePatch, armed: RunStylePatch, patch: RunStylePatch): RunStylePatch {
  const [next] = applyStyleToRange([{ text: ' ', ...withArmed(caret, armed) }], 0, 1, patch);
  const target: Record<string, unknown> = { ...next };
  delete target.text;
  const from = caret as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(from), ...Object.keys(target)])) {
    const flag = FLAGS.has(key);
    // `null` is a value here (no fill), not the absence of one.
    if (flag ? (from[key] ?? false) === (target[key] ?? false) : JSON.stringify(from[key]) === JSON.stringify(target[key])) continue;
    out[key] = key in target ? target[key] : (flag ? false : undefined);
  }
  return out as RunStylePatch;
}

/** `range` as the armed style shows over it. The armed style names every key it changes, so nothing it leaves out
 *  is superseded: a key armed `undefined` is taken off, and a flag armed `false` reads `false`. */
export function armedOver(range: RangeStyle, armed: RunStylePatch): RangeStyle {
  const out: Record<string, unknown> = { ...range };
  for (const [key, value] of Object.entries(armed)) {
    if (value === undefined) delete out[key];
    else out[key] = value;
  }
  return out as RangeStyle;
}

/** No pending style. One frozen object so re-publishing an already-empty
 *  pending style doesn't re-render every consumer. */
const NO_PENDING: RunStylePatch = Object.freeze({});

/**
 * The style armed at a collapsed caret, published for render and held in refs for `beforeinput`, which fires well
 * before React has re-rendered: the patch, and the caret offset it was armed at, `null` when nothing is armed.
 */
export function usePendingStyle() {
  const [pendingStyle, setPendingStyle] = useState<RunStylePatch>(NO_PENDING);
  const pendingRef = useRef<RunStylePatch>(NO_PENDING);
  const pendingAtRef = useRef<number | null>(null);
  const armPending = useCallback((next: RunStylePatch, at: number) => {
    const empty = Object.keys(next).length === 0;
    pendingRef.current = empty ? NO_PENDING : next;
    pendingAtRef.current = empty ? null : at;
    setPendingStyle(pendingRef.current);
  }, []);
  const dropPending = useCallback(() => {
    if (pendingAtRef.current === null) return;
    pendingRef.current = NO_PENDING;
    pendingAtRef.current = null;
    setPendingStyle(NO_PENDING);
  }, []);
  return { pendingStyle, pendingRef, pendingAtRef, armPending, dropPending };
}
