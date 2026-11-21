import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { openPointerSession, type ModifierState, type PointerSession } from '@weasel-js/routing';
import { useLatest } from '@weasel-js/react';
import { deepEqual } from '@weasel-js/registry';
import { publishLayer, settleLayer, stateOf, type LayerEntry } from './layerHost';
import { NO_MODIFIERS, readModifiers } from './layerCtx';
import type { LayerSnapshot } from './useLayerHistory';
import type { LayerCtx, LayerGesture, ModelPoint } from './layerTypes';

interface ActiveGesture {
  entry: LayerEntry;
  gesture: LayerGesture<unknown>;
  startStates: LayerSnapshot;
  startSelfState: unknown;
  /** The state the gesture last sent its layer, and the consumer's state when it did. */
  last: unknown;
  seen: unknown;
  sent: boolean;
}

/**
 * Where a gesture stands: what the consumer wrote back since its last step, else that step. A consumer passing
 * `onInput` without writing it back still has its drag build on each step and commit the last.
 */
function working(a: ActiveGesture): unknown {
  return a.entry.state !== a.seen ? stateOf(a.entry) : a.last;
}

function send(a: ActiveGesture, next: unknown): void {
  a.seen = a.entry.state;
  a.last = next;
  a.sent = true;
  publishLayer(a.entry, next);
}

/** What the gesture runner reads from the editor around it. */
export interface LayerGestureHost {
  /** A pointer event's position in model space, or null while the plot is not mounted. */
  toModel(e: PointerEvent): ModelPoint | null;
  ctxFor(modifiers: ModifierState): LayerCtx;
  layers(): readonly LayerEntry[];
  /** Called when a gesture ends having changed its layer, with every layer's state from before it began. */
  onEdit(before: LayerSnapshot): void;
}

/**
 * Runs the one layer gesture a press may start: routes each move to it and publishes what it returns, and settles
 * its layer when it ends, committed or canceled. Escape cancels.
 */
export function useLayerGesture(host: LayerGestureHost) {
  const hostRef = useLatest(host);
  const activeRef = useRef<ActiveGesture | null>(null);
  const [activeEntry, setActiveEntry] = useState<LayerEntry | null>(null);
  // The session's callbacks are fixed at gesture start, so they delegate
  // through refs holding the latest committed impl — a mid-drag re-render
  // must reach the next pointermove tick.
  const sessionRef = useRef<PointerSession | null>(null);

  const finish = useCallback(() => {
    sessionRef.current = null;
    activeRef.current = null;
    setActiveEntry(null);
  }, []);

  // A layer leaving the editor mid-drag is an unmount mid-drag, and cancels the gesture.
  const live = (entry: LayerEntry) => hostRef.current.layers().includes(entry);

  const onMoveRef = useLatest((e: PointerEvent) => {
    const a = activeRef.current;
    if (!a) return;
    if (!live(a.entry)) { sessionRef.current?.cancel(); return; }
    const model = hostRef.current.toModel(e);
    if (!model) return;
    const current = working(a);
    const next = a.gesture.onMove(current, model, e, hostRef.current.ctxFor(readModifiers(e)));
    if (next !== current) send(a, next);
  });

  const onEndRef = useLatest((e: PointerEvent) => {
    const a = activeRef.current;
    if (!a) return;
    if (!live(a.entry)) { onCancelRef.current(); return; }
    const current = working(a);
    const ctx = hostRef.current.ctxFor(readModifiers(e));
    const finalState = a.gesture.onCommit ? a.gesture.onCommit(current, ctx) : current;
    if (finalState !== current) send(a, finalState);
    const changed = !deepEqual(finalState, a.startSelfState);
    if (changed) hostRef.current.onEdit(a.startStates);
    settleLayer(a.entry, changed ? { commit: finalState, prev: a.startSelfState } : 'unchanged');
    finish();
  });

  const onCancelRef = useLatest(() => {
    const a = activeRef.current;
    if (!a) return;
    const current = working(a);
    const restored = a.gesture.onCancel ? a.gesture.onCancel(current, hostRef.current.ctxFor(NO_MODIFIERS)) : a.startSelfState;
    if (a.sent || restored !== current) send(a, restored);
    settleLayer(a.entry, 'cancel');
    finish();
  });

  // No pointer capture: consumers render their own SVG chrome into the plot
  // through `children`, and capture would retarget pointerup away from it.
  /**
   * Start `gesture` on `entry` from the press `down`. `startStates` is every layer's state before the gesture, what
   * an undo returns to and what a cancel restores the layer to; `pressed` is what the press sent the layer, if any.
   */
  const start = useCallback((
    entry: LayerEntry,
    down: ReactPointerEvent<SVGSVGElement>,
    gesture: LayerGesture<unknown>,
    startStates: LayerSnapshot,
    pressed?: { state: unknown },
  ) => {
    activeRef.current = {
      entry, gesture, startStates, startSelfState: startStates.get(entry),
      last: pressed ? pressed.state : stateOf(entry), seen: entry.state, sent: pressed !== undefined,
    };
    setActiveEntry(entry);
    sessionRef.current = openPointerSession(down.currentTarget, down, {
      onMove: (e) => onMoveRef.current(e),
      onEnd: (e) => onEndRef.current(e),
      onCancel: () => onCancelRef.current(),
    }, { capture: false, escape: true });
  }, [onCancelRef, onEndRef, onMoveRef]);

  useEffect(() => () => { sessionRef.current?.cancel(); }, []);

  const busy = useCallback(() => activeRef.current !== null, []);
  /** Cancel the gesture in flight, if any, restoring its layer. */
  const cancel = useCallback(() => { sessionRef.current?.cancel(); }, []);

  return { start, busy, cancel, activeEntry };
}
