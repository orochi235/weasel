/**
 * What the dispatcher remembers about each gesture between its events: where
 * a drag began, the trail it has drawn, and the spread a pinch opened at.
 */
import { stylusOf } from '@weasel-js/gestures';
import type { DragSample } from '../actions/invoker';
import type { InputEvent } from './matcher';

/**
 * A drag's origin in world (`x`/`y`) and client coordinates, so a context can
 * carry both `drag.delta` and `drag.screenDelta`.
 */
export interface DragOrigin { x: number; y: number; clientX?: number; clientY?: number }

/** One gesture's remembered facts, as an invocation context reads them. */
export interface GestureFacts {
  origin?: DragOrigin;
  /** The live accumulator: it grows with each move. */
  points?: DragSample[];
  startSpread?: number;
}

export interface GestureFactsStore {
  /** Record what the event that starts a gesture establishes. */
  begin(gestureId: string, event: InputEvent): void;
  /** Add a move to the gesture's trail, whether or not its handle previews:
   *  `onEnd` is handed the same trail, so an action that only reads the
   *  finished path, and declares no `onMove`, still gets every vertex. */
  sample(gestureId: string, event: InputEvent & { kind: 'pointermove' }): void;
  of(gestureId: string | undefined): GestureFacts;
  drop(gestureId: string): void;
  clear(): void;
}

export function createGestureFacts(): GestureFactsStore {
  const origins = new Map<string, DragOrigin>();
  const points = new Map<string, DragSample[]>();
  const startSpreads = new Map<string, number>();
  return {
    begin(gestureId, event) {
      if (event.kind === 'pointerdown') {
        origins.set(gestureId, {
          x: event.x ?? 0,
          y: event.y ?? 0,
          ...(event.clientX !== undefined ? { clientX: event.clientX } : {}),
          ...(event.clientY !== undefined ? { clientY: event.clientY } : {}),
        });
        points.set(gestureId, [{ x: event.x ?? 0, y: event.y ?? 0, ...stylusOf(event) }]);
      }
      if (event.kind === 'multitouch' && event.spread !== undefined) {
        startSpreads.set(gestureId, event.spread);
      }
    },
    sample(gestureId, event) {
      points.get(gestureId)?.push({ x: event.x, y: event.y, ...stylusOf(event) });
    },
    of(gestureId) {
      if (gestureId === undefined) return {};
      const origin = origins.get(gestureId);
      const trail = points.get(gestureId);
      const startSpread = startSpreads.get(gestureId);
      return {
        ...(origin !== undefined ? { origin } : {}),
        ...(trail !== undefined ? { points: trail } : {}),
        ...(startSpread !== undefined ? { startSpread } : {}),
      };
    },
    drop(gestureId) {
      origins.delete(gestureId);
      points.delete(gestureId);
      startSpreads.delete(gestureId);
    },
    clear() {
      origins.clear();
      points.clear();
      startSpreads.clear();
    },
  };
}
