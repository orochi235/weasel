/**
 * A pose run: poses published per frame, committed once.
 *
 * The frames go to `scene.overrides` — the ephemeral table a drag publishes
 * to — so an edge follows a node the run is moving, and the whole run lands as
 * one undo entry when it settles.
 *
 * **A node another gesture owns is pinned, not driven.** The run publishes
 * through a hold of its own, so an override it did not put there belongs to
 * somebody else — a drag, a resize. It never writes that id, never commits it,
 * and hands it to `step` as pinned so the producer can hold its neighbors
 * against it.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLatest, useVisibleRaf, type VisibleRaf } from '@weasel-js/react';
import type { NodeId, PoseHold, Scene } from '../../core/scene/types';

/** What a producer is told before it is asked for a frame. */
export interface PoseRunCtx<TPose> {
  /** Nodes another gesture is moving, and the pose each is drawn at. The run
   *  will not write these, so a producer holds them fixed. */
  pinned: ReadonlyMap<NodeId, TPose>;
  /** Frames this run has produced, starting at 0. */
  frame: number;
}

/** One frame of a run. */
export interface PoseRunStep<TPose> {
  /** Where the nodes it drives are this frame — the whole picture, not a
   *  delta. An id the frame omits stops being published, which is how a node
   *  leaves the run's hands. */
  poses: Iterable<readonly [NodeId, TPose]>;
  /** Whether the run is finished. The frame is published either way, and a
   *  finished run commits. */
  done: boolean;
}

/** Options for `usePoseRun`. Read fresh each frame, so they may change mid-run. */
export interface UsePoseRunOptions<TPose> {
  scene: Scene<unknown, string, TPose>;
  /** Called once per frame while running, for that frame's poses. */
  step: (ctx: PoseRunCtx<TPose>) => PoseRunStep<TPose>;
  /** The undo entry's name. Default `'Layout'`. */
  label?: string;
  /** How many nodes the commit wrote. Fires after the ops land. */
  onCommit?: (moved: number) => void;
  /** Writes of the caller's own, made inside the commit's batch so they
   *  share its undo entry. `finished` is false when `stop` cut the run short
   *  of where `step` was taking it. */
  commitWith?: (finished: boolean) => void;
  /** Clock injection, for tests. Defaults to `requestAnimationFrame`. */
  requestFrame?: (cb: (t: number) => void) => number;
  cancelFrame?: (handle: number) => void;
}

/** Controls for a pose run. Stable for the life of the component. */
export interface PoseRun {
  /** Begin a new run, counting frames from 0. Idempotent while running. */
  start(): void;
  /** Finish now: commit what is published, then drop the overrides. */
  stop(): void;
  /** Abandon: drop the overrides and write nothing, like a canceled drag. */
  cancel(): void;
  isRunning(): boolean;
}

/**
 * Drive node poses frame by frame through `scene.overrides`, committing them as
 * one undo entry when `step` reports done or `stop` is called. Idle until
 * `start`; unmounting abandons the run without writing.
 */
export function usePoseRun<TPose>(opts: UsePoseRunOptions<TPose>): PoseRun {
  const optsRef = useLatest(opts);

  /** This frame's poses. */
  const previews = useRef(new Map<NodeId, TPose>());
  /** The hold the run publishes through, and the scene it was taken from. */
  const held = useRef<{ scene: Scene<unknown, string, TPose>; hold: PoseHold<TPose> } | null>(null);
  const running = useRef(false);
  const frame = useRef(0);
  const mounted = useRef(true);

  /** The hold on the scene the options name now. A run handed a different
   *  scene mid-flight lets go of the old one's nodes. */
  const holdNow = useCallback((): PoseHold<TPose> => {
    const { scene } = optsRef.current;
    if (held.current?.scene !== scene) {
      held.current?.hold.drop();
      held.current = { scene, hold: scene.overrides.hold() };
    }
    return held.current.hold;
  }, [optsRef]);

  const release = useCallback((): void => {
    held.current?.hold.drop();
    previews.current.clear();
  }, []);

  const commit = (finished: boolean): void => {
    const scene = optsRef.current.scene;
    const also = optsRef.current.commitWith;
    let moved = 0;
    try {
      if (previews.current.size > 0 || also !== undefined) {
        scene.batch(optsRef.current.label ?? 'Layout', () => {
          for (const [id, pose] of previews.current) {
            if (scene.get(id) === undefined || scene.isLocked(id)) continue;
            scene.setPose(id, pose);
            moved++;
          }
          also?.(finished);
        });
      }
    } finally {
      release();
    }
    optsRef.current.onCommit?.(moved);
  };

  const halt = (loop: VisibleRaf): void => {
    running.current = false;
    loop.cancel();
  };

  const tick = (loop: VisibleRaf): void => {
    if (!mounted.current || !running.current) return;
    const hold = holdNow();
    const pinned = hold.others();
    const { poses, done } = optsRef.current.step({ pinned, frame: frame.current });
    frame.current++;
    previews.current.clear();
    for (const [id, pose] of poses) {
      if (pinned.has(id)) continue;
      previews.current.set(id, pose);
    }
    hold.set(previews.current);
    if (done) {
      halt(loop);
      commit(true);
      return;
    }
    loop.request();
  };

  // The gate defaults an absent clock to `requestAnimationFrame` itself, so
  // these pass straight through rather than being defaulted twice.
  const loop = useVisibleRaf((_time, loop) => { tick(loop); }, {
    requestFrame: opts.requestFrame,
    cancelFrame: opts.cancelFrame,
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      loop.cancel();
      // Teardown is not a decision: an unmounted run abandons its frames
      // rather than writing them.
      release();
    };
  }, [loop, release]);

  return useMemo<PoseRun>(() => ({
    start() {
      if (running.current || !mounted.current) return;
      running.current = true;
      frame.current = 0;
      loop.request();
    },
    stop() {
      if (!running.current) return;
      halt(loop);
      commit(false);
    },
    cancel() {
      halt(loop);
      release();
    },
    isRunning: () => running.current,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [loop]);
}
