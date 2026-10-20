/**
 * The scene's arrival window: what a live edit did to containers, collected
 * while it runs and handed to a layout handler before it closes.
 *
 * The window is open while a live edit is collecting the nodes that joined a
 * container, the ones that left one, and every container whose children or
 * size it changed; whoever opened the window settles it before the edit
 * closes. Undo, redo and journal replays never open it: they restore an
 * arrangement that was already decided.
 */
import { createEmitter } from '@weasel-js/registry';
import type { Op } from 'core/ops/types';
import { createArrangeOp, type ArrangedPose } from 'core/ops/arrange';
import { SceneArrivalRefused } from './arrivals';
import type { LayoutMove, Node, NodeId, SceneArrivalHandler } from './types';

/** What the window needs from the scene it serves. */
export interface ArrivalWindowEnv<TData, TLayer extends string, TPose> {
  nodes: Map<NodeId, Node<TData, TLayer, TPose>>;
  /** The pass over the scene's declared layouts, which settles arrivals once
   *  a container has declared one. An installed handler takes its place. */
  layoutPass: SceneArrivalHandler<TPose>;
  /** Whether a bare scene call would record an edit of its own right now:
   *  no batch is open and no history engine is driving. */
  recordsBareEdits(): boolean;
  /** Write one arranged pose. Bound into the arrange op, since not every
   *  adapter an edit is applied through can write poses. */
  writePose(id: string, pose: unknown): void;
}

export interface ArrivalWindow<TPose> {
  /** A container was given a layout: from here on the scene has arrivals to
   *  settle even with no handler installed. */
  layoutDeclared(): void;
  /** Install the handler that settles arrivals. Returns its remover. */
  setHandler(handler: SceneArrivalHandler<TPose>): () => void;
  /** Hear the poses each live edit's settle wrote, after the edit lands. */
  onReflow(listener: (moves: readonly LayoutMove<TPose>[]) => void): () => void;
  noteArrival(id: NodeId, parent: NodeId | null, from: NodeId | null): void;
  noteDeparture(id: NodeId, from: NodeId | null, to: NodeId | null): void;
  /** A container's child set or order changed, it changed size, or a child was posed. */
  noteChange(id: NodeId | null): void;
  /** Whether a bare scene call has to run as a batch of its own, so the
   *  layout pass it triggers lands in its undo step. */
  bareLayoutEdit(): boolean;
  /** Open the window when a handler wants one — or `always`, for an edit that
   *  may give the scene its first layout partway through — and no enclosing
   *  edit holds it already; true when this caller now owns it. */
  open(always?: boolean): boolean;
  /** Close the window and ask the handler what the arrivals get. Throws
   *  `SceneArrivalRefused` when it refuses, which reverts the edit. */
  settle(): ArrangedPose[];
  /** Report what the settled edit wrote, now that it has landed. */
  emitReflow(): void;
  /** Close the window with nothing settled or reported: its owner's edit is
   *  over, however it ended. */
  abandon(): void;
  /** Run an op-driven edit that may carry arrivals: a refusal reverts it and
   *  is swallowed, the way a drop onto a full container is — nothing lands.
   *  Returns whether the edit landed. */
  runEdit(ops: Op[], run: (ops: Op[]) => void): boolean;
}

/** Of the ids noted per container, those the landed edit bears out: still
 *  under it when `joined`, gone from it otherwise. A container that is itself
 *  gone is left out. */
function heldMoves(
  nodes: ReadonlyMap<NodeId, { parent: NodeId | null }>,
  noted: ReadonlyMap<NodeId, NodeId[]>,
  joined: boolean,
): Map<NodeId, NodeId[]> {
  const out = new Map<NodeId, NodeId[]>();
  for (const [parent, ids] of noted) {
    const held = ids.filter((id) => (nodes.get(id)?.parent === parent) === joined);
    if (held.length > 0 && nodes.has(parent)) out.set(parent, held);
  }
  return out;
}

export function createArrivalWindow<TData, TLayer extends string, TPose>(
  env: ArrivalWindowEnv<TData, TLayer, TPose>,
): ArrivalWindow<TPose> {
  const { nodes } = env;
  let installed: SceneArrivalHandler<TPose> | null = null;
  let hasLayouts = false;
  let arrivals: Map<NodeId, NodeId[]> | null = null;
  let departures = new Map<NodeId, NodeId[]>();
  let changed = new Set<NodeId>();
  /** What the last settle wrote, reported to `onReflow` once its edit lands. */
  let reflowDue: LayoutMove<TPose>[] | null = null;
  const reflowListeners = createEmitter<[moves: readonly LayoutMove<TPose>[]]>();

  const activeHandler = (): SceneArrivalHandler<TPose> | null => installed ?? (hasLayouts ? env.layoutPass : null);

  function open(always = false): boolean {
    if (arrivals !== null || (!always && activeHandler() === null)) return false;
    arrivals = new Map();
    departures = new Map();
    changed = new Set();
    reflowDue = null;
    return true;
  }

  function emitReflow(): void {
    const moves = reflowDue;
    reflowDue = null;
    if (moves === null || moves.length === 0) return;
    reflowListeners.emit(moves);
  }

  function settle(): ArrangedPose[] {
    const pending = arrivals;
    arrivals = null;
    const handler = activeHandler();
    if (pending === null || handler === null) return [];
    // Only what is still there once the edit's other mutations have landed.
    const landed = heldMoves(nodes, pending, true);
    // Only what is gone from the container once the edit has landed: a child
    // that left and came back did not depart.
    const left = heldMoves(nodes, departures, false);
    departures = new Map();
    const touched = new Set([...changed].filter((id) => nodes.get(id)?.kind === 'container'));
    if (landed.size === 0 && touched.size === 0) return [];
    const poses = handler(landed, touched, left);
    if (poses === null) throw new SceneArrivalRefused(landed);
    const out: ArrangedPose[] = [];
    for (const [id, to] of poses) {
      const node = nodes.get(id);
      if (node) out.push({ id, from: node.pose, to });
    }
    reflowDue = out as LayoutMove<TPose>[];
    return out;
  }

  function abandon(): void {
    arrivals = null;
    reflowDue = null;
  }

  /** `ops` plus the op that settles their arrivals, when this call owns the
   *  window; `ops` unchanged otherwise. Opened even on a scene with no layout
   *  yet: an edit's op list is fixed before it runs, and any op in it may give
   *  the scene its first. The arrange op that settles nothing elides itself. */
  function withArrivalOps(ops: Op[]): { ops: Op[]; owned: boolean } {
    if (!open(true)) return { ops, owned: false };
    return { ops: [...ops, createArrangeOp({}, settle, env.writePose)], owned: true };
  }

  return {
    layoutDeclared: () => { hasLayouts = true; },
    setHandler(handler) {
      installed = handler;
      return () => {
        if (installed === handler) installed = null;
      };
    },
    onReflow: reflowListeners.subscribe,
    noteArrival(id, parent, from) {
      if (arrivals === null || parent === null || parent === from) return;
      changed.add(parent);
      const list = arrivals.get(parent);
      if (list === undefined) arrivals.set(parent, [id]);
      else if (!list.includes(id)) list.push(id);
    },
    noteDeparture(id, from, to) {
      if (arrivals === null || from === null || from === to) return;
      changed.add(from);
      // One that joined earlier in this edit was never there to leave.
      if (arrivals.get(from)?.includes(id)) return;
      const list = departures.get(from);
      if (list === undefined) departures.set(from, [id]);
      else if (!list.includes(id)) list.push(id);
    },
    noteChange(id) {
      if (arrivals !== null && id !== null) changed.add(id);
    },
    bareLayoutEdit: () => activeHandler() !== null && arrivals === null && env.recordsBareEdits(),
    open,
    settle,
    emitReflow,
    abandon,
    runEdit(ops, run) {
      const { ops: all, owned } = withArrivalOps(ops);
      // An edit inside another's window leaves a refusal to the one that owns
      // it, which reverts the whole edit and answers for it.
      if (!owned) return run(all), true;
      try {
        run(all);
        emitReflow();
        return true;
      } catch (err) {
        if (!(err instanceof SceneArrivalRefused)) throw err;
        return false;
      } finally {
        abandon();
      }
    },
  };
}
