/**
 * The editing sessions open over one scene: the scene's own, and every
 * `EditingSession` made over it. Each holds a selection, pose previews and
 * scroll offsets of its own; the document and its one history are shared.
 * See `docs/editing-sessions.md`.
 */
import type { PoseOverrides } from './poseOverrideTypes';
import { createSceneOverrides } from './poseOverrides';
import { createScrollOffsets, type ScrollOffsets } from './scrollOffsets';
import { createSceneSelection, type SceneSelection } from './sceneSelection';
import type { NodeId } from './types';

/** What one session holds over the document. */
export interface SessionState {
  readonly selection: SceneSelection;
  readonly overrides: PoseOverrides<unknown, unknown>;
  readonly scroll: ScrollOffsets;
}

/** What a session's state is built against: the document's reach, tree and memo invalidation. */
export interface SessionStateEnv {
  reachable(ids: readonly NodeId[]): readonly NodeId[];
  parentOf(id: NodeId): NodeId | null | undefined;
  getNode(id: NodeId): { data?: unknown } | undefined;
  invalidateDependents(id: NodeId): void;
  /** Run a change notice once the edit that caused it has landed whole. */
  whenSettled(emit: () => void): void;
}

export interface SessionHost {
  /** The scene's own session. */
  readonly own: SessionState;
  /** The session whose call is running, else the scene's own: whose selection an edit records and an undo restores. */
  acting(): SessionState;
  /** Run `fn` with `state` acting. */
  actingAs<T>(state: SessionState, fn: () => T): T;
  /** A new session, held weakly: one nobody reaches is dropped without being closed. */
  open(): SessionState;
  /** Call `fn` with every live session, the scene's own first. */
  each(fn: (state: SessionState) => void): void;
  /** Make this the host `sessionHostOf(scene)` answers. */
  serve(scene: object): void;
}

function createSessionState(env: SessionStateEnv, announce?: (emit: () => void) => void): SessionState {
  return {
    selection: createSceneSelection(env.reachable, env.parentOf, announce),
    overrides: createSceneOverrides<unknown, unknown>(env.getNode, env.invalidateDependents, env.whenSettled),
    scroll: createScrollOffsets(),
  };
}

const hosts = new WeakMap<object, SessionHost>();

/** The sessions over `scene`, for a scene `createScene` or `sceneFromJSON` built. */
export function sessionHostOf(scene: object): SessionHost | undefined {
  return hosts.get(scene);
}

/** The session host of a scene being built. The scene's own selection announces at once: the scene's notifier is
 *  subscribed to it, and that notifier holds the notice itself. */
export function createSessionHost(env: SessionStateEnv): SessionHost {
  const own = createSessionState(env);
  const opened = new Set<WeakRef<SessionState>>();
  let current: SessionState | null = null;
  const host: SessionHost = {
    own,
    acting: () => current ?? own,
    actingAs(state, fn) {
      const was = current;
      current = state;
      try {
        return fn();
      } finally {
        current = was;
      }
    },
    open() {
      const state = createSessionState(env, env.whenSettled);
      opened.add(new WeakRef(state));
      return state;
    },
    each(fn) {
      fn(own);
      for (const ref of opened) {
        const state = ref.deref();
        if (state === undefined) opened.delete(ref);
        else fn(state);
      }
    },
    serve(scene) { hosts.set(scene, host); },
  };
  return host;
}
