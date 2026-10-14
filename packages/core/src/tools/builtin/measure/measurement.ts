import { createEmitter } from '@weasel-js/registry';

/** A world-space point. */
export interface MeasurePoint { x: number; y: number }

/**
 * The offset from `start` to `end`, in world units. `angle` is in radians on
 * the world's own axes — y grows downward, so a positive angle turns
 * clockwise on screen, the same sense a rotate of that many radians turns.
 */
export interface Measurement {
  readonly start: MeasurePoint;
  readonly end: MeasurePoint;
  readonly dx: number;
  readonly dy: number;
  readonly distance: number;
  /** `atan2(dy, dx)`, in `(-π, π]`. Zero for a zero-length measurement. */
  readonly angle: number;
}

/** Measure from `start` to `end`. */
export function measureBetween(start: MeasurePoint, end: MeasurePoint): Measurement {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return {
    start: { x: start.x, y: start.y },
    end: { x: end.x, y: end.y },
    dx,
    dy,
    distance: Math.hypot(dx, dy),
    angle: dx === 0 && dy === 0 ? 0 : Math.atan2(dy, dx),
  };
}

/** The measurement a measure tool holds, readable and watchable from outside
 *  the canvas — by a readout, or by the actions that transform by it. */
export interface MeasurementStore {
  get(): Measurement | null;
  set(next: Measurement | null): void;
  subscribe(listener: () => void): () => void;
}

/** An empty {@link MeasurementStore}. */
export function createMeasurementStore(): MeasurementStore {
  let current: Measurement | null = null;
  const changed = createEmitter();
  return {
    get: () => current,
    set: (next) => {
      if (next === current) return;
      current = next;
      changed.emit();
    },
    subscribe: changed.subscribe,
  };
}
