import type { PointerContextValue } from '@weasel-js/routing/react';

/** A tool's subscription to the `pointer` dep, held only while it has
 *  something trailing to the pointer. */
export interface PointerFollower {
  /** The store being followed, or `null`. */
  pointer(): PointerContextValue | null;
  /** Start following `next`; a no-op for the store already followed. */
  follow(next: PointerContextValue | undefined): void;
  unfollow(): void;
}

/** `onMove` runs after every change of the followed pointer. */
export function createPointerFollower(onMove: () => void): PointerFollower {
  let pointer: PointerContextValue | null = null;
  let off: (() => void) | null = null;
  return {
    pointer: () => pointer,
    follow(next) {
      if (!next || next === pointer) return;
      off?.();
      pointer = next;
      off = next.subscribe(onMove);
    },
    unfollow() {
      off?.();
      off = null;
      pointer = null;
    },
  };
}
