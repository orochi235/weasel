/**
 * What a scene reports about the poses it writes: each change's net pose per
 * node, the nodes it removed as they were last shown, and where each came
 * from, handed to `onPoseWrite` once the change reaches the scene's
 * subscribers.
 */
import { createEmitter, deepEqual } from '@weasel-js/registry';
import { createRemovalLog } from './poseRemovals';
import type { RegisteredOp } from './types';
import type { LayoutMove } from './layoutTypes';
import type { NodeId } from '@weasel-js/routing';

/**
 * Where a reported pose write came from.
 *
 * - `'call'` — a scene method called directly, alone or inside `scene.batch`:
 *   a button's `scene.setPose`, a `scene.add`.
 * - `'ops'` — ops applied as one edit through `applyBatch` or `history.apply`,
 *   which is how actions commit: a drag's release, a resize, a nudge, an align.
 * - `'undo'` / `'redo'` — a history step, a jump through the history included.
 * - `'layout'` — a container's layout arranging what a live edit changed; also
 *   reported to `onReflow`.
 * - `'untracked'` — a write inside `scene.untracked`, such as a pose target
 *   committing an animation's destination.
 */
export type PoseWriteOrigin = 'call' | 'ops' | 'undo' | 'redo' | 'layout' | 'untracked';

/** One node's pose as a scene change left it, in the node's stored frame. */
export interface PoseWrite<TPose> {
  id: NodeId;
  /** The pose before the change; `undefined` for a node the change added. */
  from: TPose | undefined;
  to: TPose;
  origin: PoseWriteOrigin;
  /** The edit's label (`'setPose'`, a batch's, an action's `'Move'`) for
   *  `'call'` and `'ops'`; `undefined` otherwise. */
  label?: string;
}

/** A removed node as it was last shown, with the descendants it took along. */
export interface RemovedNode<TPose, TNode = unknown> {
  /** The node as it stood before the change removed it. */
  node: TNode;
  /** Where it was shown, override included, in its stored frame. */
  pose: TPose;
  children: readonly RemovedNode<TPose, TNode>[];
}

/** One node a scene change removed, a removal's root: its descendants ride
 *  beneath it rather than being reported apart. */
export interface PoseRemoval<TPose, TNode = unknown> extends RemovedNode<TPose, TNode> {
  id: NodeId;
  /** The parent it was removed from, which may still be in the scene. */
  parent: NodeId | null;
  origin: PoseWriteOrigin;
  label?: string;
}

/** What a scene reports about the poses its edits write. */
export interface ScenePoseReports<TPose, TNode = unknown> {
  /** Called with the poses each live edit's layout pass wrote, after the
   *  edit lands — never for an undo or redo, which restore poses rather than
   *  arrange them. What a reflow animation glides from. */
  onReflow(listener: (moves: readonly LayoutMove<TPose>[]) => void): () => void;
  /** Called once per change, before the scene's subscribers hear of it, with
   *  every node whose pose the change wrote or that it added, and every node
   *  it removed — an undone add among them. A node written back to the pose
   *  it had, or both added and removed by the change, is left out of both.
   *  Not called for `loadState` or the scene's initial nodes. */
  onPoseWrite(
    listener: (writes: readonly PoseWrite<TPose>[], removed: readonly PoseRemoval<TPose, TNode>[]) => void,
  ): () => void;
}

/** What the log reads of the scene it reports for. */
export interface PoseWriteEnv<TPose, TNode> {
  /** A node still in the scene, with the pose it is shown at. */
  shown(id: NodeId): { node: TNode; pose: TPose } | undefined;
  /** Whether the edit running now is inside `scene.untracked`. */
  untracked(): boolean;
  /** The scene's change notice. The log reports on it, subscribed before
   *  anyone else so a change's writes arrive ahead of its re-reads. */
  changes: { subscribe(listener: () => void): () => void };
}

export interface PoseWriteLog<TPose, TNode = unknown> {
  subscribe: ScenePoseReports<TPose, TNode>['onPoseWrite'];
  /** Run `fn` as an edit labeled `label`; an enclosing edit's label stands. */
  labeled<T>(label: string, via: 'call' | 'ops', fn: () => T): T;
  /** Run `fn` as a history step replaying recorded ops. */
  replaying<T>(fn: () => T): T;
  /** Run `fn` as a layout pass writing arranged poses. */
  layout<T>(fn: () => T): T;
  /** Run `fn` with nothing it writes reported. */
  quiet<T>(fn: () => T): T;
  /** `register` with the kit's pose-bearing ops reporting what they write. */
  reporting(register: (kind: string, handler: RegisteredOp<unknown>) => void):
    (kind: string, handler: RegisteredOp<unknown>) => void;
}

interface Posed<TPose> { id: NodeId; pose: TPose }
interface Parented { id: NodeId; parent: NodeId | null }

export function createPoseWriteLog<TPose, TNode = unknown>(env: PoseWriteEnv<TPose, TNode>): PoseWriteLog<TPose, TNode> {
  const listeners = createEmitter<[writes: readonly PoseWrite<TPose>[], removed: readonly PoseRemoval<TPose, TNode>[]]>();
  const pending = new Map<NodeId, PoseWrite<TPose>>();
  const removals = createRemovalLog<TPose, TNode>(env.shown);
  let edit: { label: string; via: 'call' | 'ops' } | null = null;
  let replays = 0;
  let layouts = 0;
  let quiets = 0;
  let listening = 0;

  const collecting = (): boolean => listening > 0 && quiets === 0;

  function stamp(reverted: boolean): Pick<PoseWrite<TPose>, 'origin' | 'label'> {
    if (replays > 0) return { origin: reverted ? 'undo' : 'redo' };
    if (layouts > 0) return { origin: 'layout' };
    if (env.untracked()) return { origin: 'untracked' };
    return edit ? { origin: edit.via, label: edit.label } : { origin: 'call' };
  }

  function noteSet(id: NodeId, from: TPose, to: TPose, reverted: boolean): void {
    if (!collecting()) return;
    const held = pending.get(id);
    if (held) held.to = to;
    else pending.set(id, { id, from, to, ...stamp(reverted) });
  }

  function noteAdded(nodes: readonly Posed<TPose>[], reverted: boolean): void {
    if (!collecting()) return;
    for (const n of nodes) {
      // Removed and back within one change: it moved, if anything.
      pending.set(n.id, { id: n.id, from: removals.takeBack(n.id), to: n.pose, ...stamp(reverted) });
    }
  }

  const seeOff = (roots: readonly Parented[], nodes: readonly Parented[], reverted: boolean): () => void =>
    collecting() ? removals.seeOff(roots, nodes, stamp(reverted), pending) : () => {};

  function around<T>(fn: () => T, enter: () => void, leave: () => void): T {
    enter();
    try {
      return fn();
    } finally {
      leave();
    }
  }

  type SetPayload = { id: NodeId; from: TPose; to: TPose };
  type AddPayload = Posed<TPose> & Parented;
  type RemovePayload = { nodes: readonly (Posed<TPose> & Parented)[]; detached: readonly Parented[] };
  const wrap: Record<string, (h: RegisteredOp<unknown>) => RegisteredOp<unknown>> = {
    'kit:setPose': (h) => ({
      ...h,
      apply: (p) => { h.apply(p); const s = p as SetPayload; noteSet(s.id, s.from, s.to, false); },
      revert: (p) => { h.revert(p); const s = p as SetPayload; noteSet(s.id, s.to, s.from, true); },
    }),
    'kit:add': (h) => ({
      ...h,
      apply: (p) => { h.apply(p); noteAdded([p as AddPayload], false); },
      revert: (p) => { const done = seeOff([p as AddPayload], [p as AddPayload], true); h.revert(p); done(); },
    }),
    'kit:remove': (h) => ({
      ...h,
      apply: (p) => {
        const r = p as RemovePayload;
        const done = seeOff(r.detached, r.nodes, false);
        h.apply(p);
        done();
      },
      revert: (p) => { h.revert(p); noteAdded((p as RemovePayload).nodes, true); },
    }),
  };

  function flush(): void {
    const removed = removals.drain();
    if (pending.size === 0 && removed.length === 0) return;
    const writes = [...pending.values()].filter((w) => !deepEqual(w.from, w.to));
    pending.clear();
    if (writes.length > 0 || removed.length > 0) listeners.emit(writes, removed);
  }
  env.changes.subscribe(flush);

  return {
    subscribe(listener) {
      const off = listeners.subscribe(listener);
      listening++;
      let on = true;
      return () => {
        if (!on) return;
        on = false;
        listening--;
        off();
      };
    },
    labeled(label, via, fn) {
      if (edit) return fn();
      return around(fn, () => { edit = { label, via }; }, () => { edit = null; });
    },
    replaying: (fn) => around(fn, () => { replays++; }, () => { replays--; }),
    layout: (fn) => around(fn, () => { layouts++; }, () => { layouts--; }),
    quiet: (fn) => around(fn, () => { quiets++; }, () => { quiets--; }),
    reporting: (register) => (kind, handler) => register(kind, wrap[kind]?.(handler) ?? handler),
  };
}
