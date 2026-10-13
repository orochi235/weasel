/**
 * Turns pointer samples into the gestures they add up to: a press, the drag
 * it becomes past the threshold, the click it is when released in place, the
 * double click two of those make, a long-press, and multitouch.
 *
 * It decides with its sink's answers, so it is not a pure function of its
 * input: a long-press only spends its press when something handled it.
 */
import type { EventModifiers, InputEvent } from '../ui/inputEvent';
import { pastDragThreshold } from '../ui/dragThreshold';
import { composeClick, type ClickMemory, type ClickObserver, type ReleaseOutcome } from './click';
import { createLongPressHold, type HeldPress, type RecognizerClock } from './longPressHold';
import { createMultiTouchEpisode, multiTouchGeometry, type Point } from './multiTouch';
import { longPressEvents, type PressFacts } from './pressFacts';
import {
  modifiersOf, pointerDownEvent, pointerMoveEvent, pointerUpEvent, pressFactsOf,
  type PointerSample, type PressSample,
} from './samples';
import { LONG_PRESS_MS } from './thresholds';

/** Where recognized events go. */
export interface RecognizerSink {
  dispatch(ev: InputEvent): 'handled' | 'unhandled';
  /** Whether a multitouch gesture of `fingers` fingers is running, to be pumped. */
  multiTouchInFlight(fingers: number): boolean;
}

/** What a host hears about beyond the events themselves, to drive press feedback. */
export interface RecognizerObserver extends ClickObserver {
  /** The press being held toward a long-press, or `null` once it fires or is abandoned. */
  holdChanged?(pending: HeldPress | null): void;
  /** A long-press something handled, as itself or as its contextmenu fallback. */
  longPress?(pointerType: 'touch' | 'pen'): void;
}

/** What {@link createPointerRecognizer} needs from its host. */
export interface PointerRecognizerOptions {
  sink: RecognizerSink;
  clock: RecognizerClock;
  /**
   * Client point to world point; the identity by default. Asked as each event
   * is built rather than once per sample: an event dispatched earlier in the
   * same sample, a pinch step say, may have moved the view.
   */
  toWorld?: (clientX: number, clientY: number) => Point;
  /** Client point to the space a multitouch centroid is reported in. The identity by default. */
  toSurface?: (client: Point) => Point;
  /** Long-press hold time in ms, read at each press. Default `LONG_PRESS_MS`. */
  longPressMs?: () => number | undefined;
  clicks?: ClickMemory;
  observer?: RecognizerObserver;
}

/** A recognizer for one surface. Its host feeds it every pointer sample the surface receives. */
export interface PointerRecognizer {
  press(sample: PressSample): void;
  /** A move of any pointer, held or not. */
  move(sample: PointerSample): void;
  release(sample: PointerSample): ReleaseOutcome;
  /** A held pointer ended without a release. */
  cancel(pointerId: number): void;
  /**
   * Whether a touch or pen that armed a long-press is still held. One still
   * pending fires here, ahead of its timer: a platform that reports the hold
   * itself is reporting the same one.
   */
  takeHold(): boolean;
  heldCount(): number;
  /** A held pointer's latest client position. */
  positionOf(pointerId: number): Point | undefined;
  /** Forget every held pointer and stop timing, dispatching nothing. */
  reset(): void;
}

interface Held {
  pos: Point;
  /** The press, withheld until movement crosses the drag threshold. Null once
   *  forwarded, spent by a long-press, or claimed by multitouch. */
  buffered: InputEvent | null;
  down: PressFacts;
  /** Set on a pointer that armed a long-press, for as long as it is held. */
  holdType?: 'touch' | 'pen';
}

function multiTouchEvent(
  fingers: number,
  mods: EventModifiers,
  more: { centroid: Point; spread: number } | { end: 'commit' | 'cancel' },
): InputEvent {
  return { kind: 'multitouch', fingers, ...modifiersOf(mods), ...more };
}

const positionsOf = (held: ReadonlyMap<number, Held>): Map<number, Point> =>
  new Map([...held].map(([id, p]) => [id, p.pos]));

/** The held pointers' geometry, plus `extra` points, with the centroid in surface space. */
function heldGeometry(
  held: ReadonlyMap<number, Held>,
  toSurface: (client: Point) => Point,
  extra: Point[],
): { centroid: Point; spread: number } {
  const g = multiTouchGeometry([...positionsOf(held).values(), ...extra]);
  return { centroid: toSurface(g.centroid), spread: g.spread };
}

/** A hold that lasted: a long-press, or the contextmenu it falls back to. */
function fireLongPress(rec: Held | undefined, sink: RecognizerSink, observer: RecognizerObserver): void {
  if (!rec) return;
  const evs = longPressEvents(rec.down);
  let result = sink.dispatch(evs.longpress);
  if (result === 'unhandled') result = sink.dispatch(evs.contextmenu);
  if (result === 'unhandled') return;
  // The press is spent: its release must not click, nor a later move open a drag.
  rec.buffered = null;
  if (rec.holdType) observer.longPress?.(rec.holdType);
}

/** Build a recognizer holding no pointers. It touches no DOM: time and timers come from `opts.clock`. */
export function createPointerRecognizer(opts: PointerRecognizerOptions): PointerRecognizer {
  const { sink, clock, observer = {}, toSurface = (p) => p } = opts;
  const world = (s: PointerSample): Point => opts.toWorld?.(s.clientX, s.clientY) ?? { x: s.clientX, y: s.clientY };
  const clicks = opts.clicks ?? { last: null };
  const held = new Map<number, Held>();
  const touches = createMultiTouchEpisode();
  const hold = createLongPressHold(clock, (pending) => { observer.holdChanged?.(pending); });
  const longPressMs = (): number => opts.longPressMs?.() ?? LONG_PRESS_MS;
  const geometry = (extra: Point[] = []) => heldGeometry(held, toSurface, extra);

  // MULTI-POINTER POLICY: multitouch takes every pointer that has not already
  // committed to a gesture, by clearing its buffered press. One that already
  // opened a drag has no buffer left to claim, so its drag survives the second
  // finger: yanking it from someone who rested a palm is worse than letting it finish.
  const claimForMultiTouch = (mods: EventModifiers): void => {
    hold.cancel();
    for (const p of held.values()) p.buffered = null;
    const g = geometry();
    touches.join(positionsOf(held), g.centroid, clock.now());
    sink.dispatch(multiTouchEvent(held.size, mods, g));
  };

  return {
    press(s) {
      const ev = pointerDownEvent(s);
      const rec: Held = { pos: { x: s.clientX, y: s.clientY }, buffered: ev, down: pressFactsOf(s) };
      held.set(s.pointerId, rec);
      // The press dispatches twice, to disjoint spec kinds: now for
      // `pointerDown` bindings, and buffered for `drag`. A second finger's is
      // withheld, or it would act under the pinch it belongs to.
      if (held.size < 2) sink.dispatch({ ...ev, stage: 'press' });
      if ((s.pointerType === 'touch' || s.pointerType === 'pen') && held.size === 1) {
        rec.holdType = s.pointerType;
        hold.arm(
          { pointerId: s.pointerId, pointerType: s.pointerType, press: rec.down, startedAt: clock.now(), duration: longPressMs() },
          () => { fireLongPress(held.get(s.pointerId), sink, observer); },
        );
      }
      if (held.size >= 2) claimForMultiTouch(s);
    },

    move(s) {
      const rec = held.get(s.pointerId);
      const to = { x: s.clientX, y: s.clientY };
      if (rec) rec.pos = to;
      touches.moved(s.pointerId, to);
      // The buffered press goes out before the move: it opens the drag the moves pump.
      if (rec?.buffered && pastDragThreshold(rec.down, s)) {
        const press = rec.buffered;
        rec.buffered = null;
        hold.cancel(s.pointerId);
        sink.dispatch(press);
      }
      if (held.size >= 2 && sink.multiTouchInFlight(held.size)) {
        sink.dispatch(multiTouchEvent(held.size, s, geometry()));
      }
      sink.dispatch(pointerMoveEvent(s, world(s)));
    },

    release(s) {
      hold.cancel(s.pointerId);
      const before = held.size;
      const rec = held.get(s.pointerId);
      held.delete(s.pointerId);
      // Any finger lifting ends the multitouch gesture the hand was making.
      if (before >= 2) sink.dispatch(multiTouchEvent(before, s, { end: 'commit' }));
      if (before >= 2 && held.size < 2) {
        // The centroid as it was with this pointer still down.
        const fingers = touches.finish(
          geometry([{ x: s.clientX, y: s.clientY }]).centroid, clock.now(), longPressMs(),
        );
        if (fingers !== null) sink.dispatch({ kind: 'multitouchtap', fingers, ...modifiersOf(s) });
      }
      sink.dispatch(pointerUpEvent(s, world(s)));
      // A press still buffered never crossed the drag threshold, and nothing
      // else spent it. Without this, a tool binding `click` but not `drag`
      // would click on the release of a drag clear across the canvas.
      if (!rec?.buffered) return {};
      const at = world(s);
      const up = {
        target: s.target, clientX: s.clientX, clientY: s.clientY, worldX: at.x, worldY: at.y, ...modifiersOf(s),
      };
      return composeClick(rec.down, up, clicks, () => clock.now(), (ev) => sink.dispatch(ev), observer);
    },

    cancel(pointerId) {
      const rec = held.get(pointerId);
      if (!rec) return;
      const before = held.size;
      held.delete(pointerId);
      hold.cancel(pointerId);
      // A cancel carries no modifiers of its own, so these are the press's.
      if (before >= 2) sink.dispatch(multiTouchEvent(before, rec.down, { end: 'cancel' }));
      touches.abandon();
      sink.dispatch({ kind: 'pointercancel', pointerId, ...modifiersOf(rec.down) });
    },

    takeHold() {
      let holding = false;
      for (const [id, rec] of held) {
        if (!rec.holdType) continue;
        holding = true;
        if (!hold.pendingFor(id)) continue;
        hold.cancel(id);
        fireLongPress(rec, sink, observer);
      }
      return holding;
    },

    heldCount: () => held.size,
    positionOf: (pointerId) => held.get(pointerId)?.pos,
    reset() {
      hold.cancel();
      held.clear();
      touches.abandon();
    },
  };
}
