/**
 * A pose run: poses published per frame, committed once.
 *
 * The frames go to `scene.overrides` — the ephemeral table a drag publishes to,
 * which `effectivePose`, the derived-geometry lookup and the pick source
 * already read. So an edge follows a node the run is moving with nothing added,
 * and the whole run lands as one undo entry when it settles.
 *
 * It knows nothing about layout. Each frame it asks `step` for poses and
 * whether it is finished; a relaxation, an eased transition to a target, and a
 * scrubbed timeline are all the same shape to it.
 *
 * **A node another gesture owns is pinned, not driven.** The run publishes
 * entries it holds by reference, so an override it did not put there belongs to
 * somebody else — a drag, a resize. It never writes that id, never commits it,
 * and hands it to `step` as pinned so the producer can hold its neighbors
 * against it.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useVisibleRaf } from '../../scheduling/useVisibleRaf';
import {
  dropPreviewOverrides,
  syncPreviewOverrides,
} from '../../interactions/actions/previewOverrides';
import type { NodeId, Scene } from '../../core/scene/types';

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
   *  leaves the run's hands: a producer that drops a grabbed box and its rows
   *  from one frame has released them by the next. */
  poses: Iterable<readonly [NodeId, TPose]>;
  /** Whether the run is finished. The frame is published either way, and a
   *  finished run commits. */
  done: boolean;
}

export interface UsePoseRunOptions<TPose> {
  scene: Scene<unknown, string, TPose>;
  step: (ctx: PoseRunCtx<TPose>) => PoseRunStep<TPose>;
  /** The undo entry's name. Default `'Layout'`. */
  label?: string;
  /** How many nodes the commit wrote. Fires after the ops land. */
  onCommit?: (moved: number) => void;
  /** Clock injection, for tests. Defaults to `requestAnimationFrame`. */
  requestFrame?: (cb: (t: number) => void) => number;
  cancelFrame?: (handle: number) => void;
}

export interface PoseRun {
  /** Begin, or continue where a `stop` left off. Idempotent while running. */
  start(): void;
  /** Finish now: commit what is published, then drop the overrides. */
  stop(): void;
  /** Abandon: drop the overrides and write nothing, like a canceled drag. */
  cancel(): void;
  isRunning(): boolean;
}

const EMPTY: ReadonlyMap<NodeId, unknown> = new Map<NodeId, unknown>();

export function usePoseRun<TPose>(opts: UsePoseRunOptions<TPose>): PoseRun {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  /** This frame's poses, and the entries published for them. Held by
   *  reference so a frame mutates in place rather than re-notifying per node. */
  const state = useRef({
    previews: new Map<NodeId, unknown>(),
    overrideEntries: new Map<NodeId, { pose: unknown }>(),
  });
  const running = useRef(false);
  const frame = useRef(0);
  const mounted = useRef(true);

  // The gate defaults an absent clock to `requestAnimationFrame` itself, so
  // these pass straight through rather than being defaulted twice.
  const loop = useVisibleRaf(() => { tick(); }, {
    requestFrame: opts.requestFrame,
    cancelFrame: opts.cancelFrame,
  });

  /** The scene as the previous frame left it, for `syncPreviewOverrides`. */
  const syncState = (): {
    scene: Scene<unknown, string, unknown>;
    previews: Map<NodeId, unknown>;
    overrideEntries: Map<NodeId, { pose: unknown }>;
  } => ({
    scene: optsRef.current.scene as Scene<unknown, string, unknown>,
    previews: state.current.previews,
    overrideEntries: state.current.overrideEntries,
  });

  /** Overrides somebody else published, and the pose each carries. */
  const pinnedNow = (): ReadonlyMap<NodeId, TPose> => {
    const { overrides } = optsRef.current.scene;
    let pinned: Map<NodeId, TPose> | undefined;
    for (const id of overrides.ids()) {
      const entry = overrides.get(id);
      if (entry === undefined || entry === state.current.overrideEntries.get(id)) continue;
      if (entry.pose === undefined) continue;
      (pinned ??= new Map()).set(id, entry.pose);
    }
    return pinned ?? (EMPTY as ReadonlyMap<NodeId, TPose>);
  };

  const commit = (): void => {
    const { previews } = state.current;
    const scene = optsRef.current.scene;
    let moved = 0;
    if (previews.size > 0) {
      scene.batch(optsRef.current.label ?? 'Layout', () => {
        for (const [id, pose] of previews) {
          if (scene.get(id) === undefined) continue;
          scene.setPose(id, pose as TPose);
          moved++;
        }
      });
    }
    // After the ops land: dropping first leaves a window in which the scene
    // answers with the pre-run pose.
    dropPreviewOverrides(syncState());
    previews.clear();
    optsRef.current.onCommit?.(moved);
  };

  const halt = (): void => {
    running.current = false;
    loop.cancel();
  };

  const tick = (): void => {
    if (!mounted.current || !running.current) return;
    const pinned = pinnedNow();
    const { poses, done } = optsRef.current.step({ pinned, frame: frame.current });
    frame.current++;
    // Each frame replaces the last: an id this one omits — a node just
    // grabbed, or a row under one — stops being published, rather than being
    // held at a pose from before the press while the gesture carries it
    // somewhere else.
    state.current.previews.clear();
    for (const [id, pose] of poses) {
      if (pinned.has(id)) continue;
      state.current.previews.set(id, pose);
    }
    syncPreviewOverrides(syncState());
    if (done) {
      halt();
      commit();
      return;
    }
    loop.request();
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      loop.cancel();
      // Teardown is not a decision: an unmounted run abandons its frames
      // rather than writing them.
      dropPreviewOverrides(syncState());
      state.current.previews.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop]);

  return useMemo<PoseRun>(() => ({
    start() {
      if (running.current || !mounted.current) return;
      running.current = true;
      frame.current = 0;
      loop.request();
    },
    stop() {
      if (!running.current) return;
      halt();
      commit();
    },
    cancel() {
      halt();
      dropPreviewOverrides(syncState());
      state.current.previews.clear();
    },
    isRunning: () => running.current,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [loop]);
}
