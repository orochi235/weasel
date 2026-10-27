/**
 * What the dispatcher remembers about each gesture between its events: where
 * a drag began, the trail it has drawn, the spread a pinch opened at, and how
 * far its fingers have turned.
 */
import { stylusOf } from '@weasel-js/gestures';
import type { DragSample } from '../actions/invoker';
import type { RoleKeys } from '../actions/modifierRoles';
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
  /** Degrees a multitouch gesture's fingers have turned since it began. */
  rotation?: number;
  /** The keys each of the action's modifier roles answers to, `'mod'`
   *  already resolved for the platform. */
  roleKeys?: Readonly<Record<string, RoleKeys>>;
}

export interface GestureFactsStore {
  /** Record what the event that starts a gesture establishes, and the keys
   *  its action's modifier roles answer to. */
  begin(gestureId: string, event: InputEvent, roleKeys?: Readonly<Record<string, RoleKeys>>): void;
  /** Add a move to the gesture's trail, whether or not its handle previews:
   *  `onEnd` is handed the same trail, so an action that only reads the
   *  finished path, and declares no `onMove`, still gets every vertex. */
  sample(gestureId: string, event: InputEvent & { kind: 'pointermove' }): void;
  /** Give a drag taken over mid-gesture the trail drawn before the hand-off, if it began. */
  resumeTrail(gestureId: string, trail: readonly DragSample[]): void;
  /** Add a multitouch move's change of angle to the gesture's turn. */
  turn(gestureId: string, event: InputEvent & { kind: 'multitouch' }): void;
  of(gestureId: string | undefined): GestureFacts;
  drop(gestureId: string): void;
  clear(): void;
}

export function createGestureFacts(): GestureFactsStore {
  const origins = new Map<string, DragOrigin>();
  const points = new Map<string, DragSample[]>();
  const startSpreads = new Map<string, number>();
  const turns = new Map<string, { last: number; total: number }>();
  const roles = new Map<string, Readonly<Record<string, RoleKeys>>>();
  return {
    begin(gestureId, event, roleKeys) {
      if (roleKeys) roles.set(gestureId, roleKeys);
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
      if (event.kind === 'multitouch' && event.angle !== undefined) {
        turns.set(gestureId, { last: event.angle, total: 0 });
      }
    },
    sample(gestureId, event) {
      points.get(gestureId)?.push({ x: event.x, y: event.y, ...stylusOf(event) });
    },
    resumeTrail(gestureId, trail) {
      if (points.has(gestureId)) points.set(gestureId, [...trail]);
    },
    turn(gestureId, event) {
      const turn = turns.get(gestureId);
      if (!turn || event.angle === undefined) return;
      // The shorter way round: an angle crossing 180 has not turned a full circle.
      const step = event.angle - turn.last;
      turn.total += step - 360 * Math.round(step / 360);
      turn.last = event.angle;
    },
    of(gestureId) {
      if (gestureId === undefined) return {};
      const origin = origins.get(gestureId);
      const trail = points.get(gestureId);
      const startSpread = startSpreads.get(gestureId);
      const turn = turns.get(gestureId);
      const roleKeys = roles.get(gestureId);
      return {
        ...(roleKeys !== undefined ? { roleKeys } : {}),
        ...(origin !== undefined ? { origin } : {}),
        ...(trail !== undefined ? { points: trail } : {}),
        ...(startSpread !== undefined ? { startSpread } : {}),
        ...(turn !== undefined ? { rotation: turn.total } : {}),
      };
    },
    drop(gestureId) {
      origins.delete(gestureId);
      points.delete(gestureId);
      startSpreads.delete(gestureId);
      turns.delete(gestureId);
      roles.delete(gestureId);
    },
    clear() {
      origins.clear();
      points.clear();
      startSpreads.clear();
      turns.clear();
      roles.clear();
    },
  };
}
