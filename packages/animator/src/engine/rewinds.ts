import type { Handle } from '@msb235/blits';
import type { Slot } from './lanes';

/** What {@link createRewinds} reads of a codec voice. */
export interface Rewindable {
  slot: Slot;
  /** Absent while a tween waits to be cued. */
  handle?: Handle<unknown>;
  /** Its first frame. */
  from: number[];
  /** A spring's start, where a re-cue has moved its first frame since. */
  spring?: { from: number[] };
}

/**
 * The voices playing backward. blits takes one out of its mix once its clock is back at 0, and
 * its subject then reads as though it never ran; for an offset that is its destination. The
 * animator ends the animation there holding its start, so until it stops the voice, each frame
 * puts the voice's first frame back where its subject is read.
 */
export interface Rewinds<V extends Rewindable> {
  /** Says `v` plays at `rate` from here. */
  rate(v: V, rate: number): void;
  /** After a frame has read every subject: marks the voices back at their start, and adds what
   *  each shows into its subject's axes. */
  frame(): void;
  /** Whether `v` has run back to its start. */
  has(v: V): boolean;
  /** Says `v` was cued again, from a start of its own. */
  recued(v: V): void;
  remove(v: V): void;
}

const firstOf = (v: Rewindable): number[] => v.spring?.from ?? v.from;

export function createRewinds<V extends Rewindable>(): Rewinds<V> {
  const backward = new Set<V>();
  const back = new Set<V>();
  return {
    rate(v, rate) {
      // One back at its start has left blits' mix, and plays no further either way.
      if (rate < 0) backward.add(v);
      else backward.delete(v);
    },
    frame() {
      for (const v of backward) if (v.handle?.state === 'done') back.add(v);
      for (const v of back) {
        const { cols, at } = v.slot;
        const first = firstOf(v);
        for (let i = 0; i < first.length; i++) cols[at + i] = cols[at + i]! + first[i]!;
      }
    },
    has: (v) => back.has(v),
    recued: (v) => { back.delete(v); },
    remove(v) {
      backward.delete(v);
      back.delete(v);
    },
  };
}
