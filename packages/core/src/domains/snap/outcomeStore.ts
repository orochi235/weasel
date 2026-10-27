import type { SnapMark } from './types';

type Point = { x: number; y: number };

/** The marks of the snap in flight, for the readout to draw. */
export interface SnapOutcomeStore<P = Point> {
  get(): readonly SnapMark<P>[];
  set(marks: readonly SnapMark<P>[]): void;
  subscribe(listener: () => void): () => void;
}

const NONE: readonly never[] = [];

/** An empty outcome store, which notifies only when the marks change. */
export function createSnapOutcomeStore<P = Point>(): SnapOutcomeStore<P> {
  let marks: readonly SnapMark<P>[] = NONE;
  const listeners = new Set<() => void>();
  return {
    get: () => marks,
    set(next) {
      if (next.length === 0 && marks.length === 0) return;
      marks = next.length === 0 ? NONE : next;
      for (const l of [...listeners]) l();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
