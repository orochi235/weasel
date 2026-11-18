/** The pen's rubber band and close hint, trailing the `pointer` dep while a path is in progress. */
import type { PointSnap } from '@weasel-js/core';
import type { ActionDeps } from '@weasel-js/routing';
import { withinPxRadius } from '@weasel-js/geom';
import { createPointerFollower } from '@weasel-js/editing';
import type { PenScratch } from './usePenTool';

export interface PenTrail {
  /** Repaint after a scratch change. */
  refresh(): void;
  /** The same, following `deps`' pointer from here on. */
  update(deps: ActionDeps): void;
  stop(): void;
}

/** Keeps `s.cursor` and `s.closeHintActive` on the pointer, snapped through
 *  `snaps` about the last anchor, and calls `repaint` after each change.
 *  `closePx` is read on every move. */
export function createPenTrail(s: PenScratch, snaps: PointSnap, closePx: () => number, repaint: () => void): PenTrail {
  // The deps last followed through.
  let followed: ActionDeps | undefined;
  const follower = createPointerFollower(() => track());
  const track = (): void => {
    if (!s.current && s.finishedSubpaths.length === 0) follower.unfollow();
    const at = s.current ? follower.pointer()?.get() ?? null : null;
    // A handle drag snaps through its own session, and hides the rubber band.
    if (!at || s.draggingHandleAt !== null) snaps.stop();
    s.cursor = !at ? null
      : s.draggingHandleAt !== null ? { ...at.world }
        : snaps.trail(followed?.snap, at.world, s.current?.anchors.at(-1));
    const first = s.current && s.current.anchors.length >= 3 ? s.current.anchors[0] : null;
    s.closeHintActive = first !== null && s.cursor !== null && withinPxRadius(
      first.x - s.cursor.x, first.y - s.cursor.y,
      closePx(), followed?.view?.get().scale ?? { x: 1, y: 1 },
    );
    repaint();
  };
  return {
    refresh: track,
    update(deps) {
      followed = deps;
      follower.follow(deps.pointer);
      track();
    },
    stop() {
      follower.unfollow();
      snaps.stop();
      repaint();
    },
  };
}
