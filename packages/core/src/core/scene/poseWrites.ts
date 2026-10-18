/**
 * What a scene reports about the poses it writes: each change's net pose per
 * node and where the write came from, handed to `onPoseWrite` once the change
 * reaches the scene's subscribers.
 */
import { createEmitter, deepEqual } from '@weasel-js/registry';
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

/** What a scene reports about the poses its edits write. */
export interface ScenePoseReports<TPose> {
  /** Called with the poses each live edit's layout pass wrote, after the
   *  edit lands — never for an undo or redo, which restore poses rather than
   *  arrange them. What a reflow animation glides from. */
  onReflow(listener: (moves: readonly LayoutMove<TPose>[]) => void): () => void;
  /** Called with every node whose pose a change wrote or that it added, once
   *  per change, before the scene's subscribers hear of it. A node written
   *  back to the pose it had, or removed by the change, is left out. Not
   *  called for `loadState` or the scene's initial nodes. */
  onPoseWrite(listener: (writes: readonly PoseWrite<TPose>[]) => void): () => void;
}

/** What the log reads of the scene it reports for. */
export interface PoseWriteEnv {
  /** Whether the edit running now is inside `scene.untracked`. */
  untracked(): boolean;
  /** The scene's change notice. The log reports on it, subscribed before
   *  anyone else so a change's writes arrive ahead of its re-reads. */
  changes: { subscribe(listener: () => void): () => void };
}

export interface PoseWriteLog<TPose> {
  subscribe: ScenePoseReports<TPose>['onPoseWrite'];
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

export function createPoseWriteLog<TPose>(env: PoseWriteEnv): PoseWriteLog<TPose> {
  const listeners = createEmitter<[writes: readonly PoseWrite<TPose>[]]>();
  const pending = new Map<NodeId, PoseWrite<TPose>>();
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
    for (const n of nodes) pending.set(n.id, { id: n.id, from: undefined, to: n.pose, ...stamp(reverted) });
  }

  function noteGone(ids: readonly NodeId[]): void {
    for (const id of ids) pending.delete(id);
  }

  function around<T>(fn: () => T, enter: () => void, leave: () => void): T {
    enter();
    try {
      return fn();
    } finally {
      leave();
    }
  }

  type SetPayload = { id: NodeId; from: TPose; to: TPose };
  type AddPayload = Posed<TPose>;
  type RemovePayload = { nodes: readonly Posed<TPose>[] };
  const wrap: Record<string, (h: RegisteredOp<unknown>) => RegisteredOp<unknown>> = {
    'kit:setPose': (h) => ({
      ...h,
      apply: (p) => { h.apply(p); const s = p as SetPayload; noteSet(s.id, s.from, s.to, false); },
      revert: (p) => { h.revert(p); const s = p as SetPayload; noteSet(s.id, s.to, s.from, true); },
    }),
    'kit:add': (h) => ({
      ...h,
      apply: (p) => { h.apply(p); noteAdded([p as AddPayload], false); },
      revert: (p) => { h.revert(p); noteGone([(p as AddPayload).id]); },
    }),
    'kit:remove': (h) => ({
      ...h,
      apply: (p) => { h.apply(p); noteGone((p as RemovePayload).nodes.map((n) => n.id)); },
      revert: (p) => { h.revert(p); noteAdded((p as RemovePayload).nodes, true); },
    }),
  };

  function flush(): void {
    if (pending.size === 0) return;
    const writes = [...pending.values()].filter((w) => !deepEqual(w.from, w.to));
    pending.clear();
    if (writes.length > 0) listeners.emit(writes);
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
