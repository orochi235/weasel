/**
 * Scene edit passes: functions that hear what a live edit did, once its own
 * mutations and the arrival handler have run, and answer with ops that join
 * the same undo entry.
 *
 * A pass sees one summary per edit. Its own writes are not summarized, so a
 * pass never re-triggers itself or another. Undo, redo, and history replays
 * never run passes: they restore an edit whose passes already ran.
 */
import type { Op } from 'core/ops/types';
import type { NodeId } from './types';

/** What one live edit did to the scene's nodes, by id. */
export interface SceneEditSummary {
  added: ReadonlySet<NodeId>;
  removed: ReadonlySet<NodeId>;
  posed: ReadonlySet<NodeId>;
  /** Nodes that changed parent. A reorder among siblings is not here. */
  reparented: ReadonlySet<NodeId>;
  dataChanged: ReadonlySet<NodeId>;
}

/** A scene edit pass: the ops `summary`'s edit also makes, or null for none. */
export type SceneEditPass = (summary: SceneEditSummary) => readonly Op[] | null;

/** The scene's edit-pass member. */
export interface SceneEditPasses {
  /** Add a pass that hears each live edit once its own mutations and the
   *  arrival handler have run, and answers with ops that join the same undo
   *  entry. A bare scene call runs as an edit of its own while any pass is
   *  added. Passes do not hear their own writes, and undo, redo, and history
   *  replays never run them. Returns the pass's remover. */
  addEditPass(pass: SceneEditPass): () => void;
}

/** What the passes need from the scene they serve. */
export interface EditPassEnv {
  /** The adapter a pass's ops apply through. */
  adapter(): unknown;
  /** Whether an edit made now is untracked, and so not summarized. */
  untracked(): boolean;
}

export interface EditPasses {
  /** Add a pass after every one already added. Returns its remover. */
  add(pass: SceneEditPass): () => void;
  /** Whether any pass is installed. */
  any(): boolean;
  /** Start summarizing an edit when a pass is installed and no enclosing edit
   *  is summarizing already; true when this caller now owns the summary. */
  open(): boolean;
  /** Note what a live kit op is about to write. */
  note(kind: string, payload: unknown): void;
  /** Close the summary and run every pass over it, applying their ops.
   *  Answers how many ops applied. */
  run(): number;
  /** Close the summary with nothing run. */
  abandon(): void;
  /** An op that runs the passes when it first applies, for the end of an
   *  op-driven edit whose summary the caller owns. */
  op(): Op;
}

interface Collecting {
  added: Set<NodeId>;
  removed: Set<NodeId>;
  posed: Set<NodeId>;
  reparented: Set<NodeId>;
  dataChanged: Set<NodeId>;
}

const NOOP: Op = { name: 'editPass', args: {}, elideNoop: true, apply: () => 'noop', invert: () => NOOP };

/** Note one kit op's ids into `into`. */
function noteInto(into: Collecting, kind: string, payload: unknown): void {
  const p = payload as { id?: NodeId; nodes?: readonly { id: NodeId }[]; fromParent?: NodeId | null; toParent?: NodeId | null };
  switch (kind) {
    case 'kit:add': into.added.add(p.id!); break;
    case 'kit:remove': for (const n of p.nodes ?? []) into.removed.add(n.id); break;
    case 'kit:setPose': into.posed.add(p.id!); break;
    case 'kit:setData': into.dataChanged.add(p.id!); break;
    case 'kit:move': if (p.fromParent !== p.toParent) into.reparented.add(p.id!); break;
    default: break;
  }
}

export function createEditPasses(env: EditPassEnv): EditPasses {
  const passes: SceneEditPass[] = [];
  let collecting: Collecting | null = null;

  function run(): number {
    const summary = collecting;
    collecting = null;
    if (summary === null || passes.length === 0) return 0;
    let applied = 0;
    for (const pass of [...passes]) {
      const ops = pass(summary);
      if (ops === null) continue;
      const adapter = env.adapter();
      for (const op of ops) {
        op.apply(adapter);
        applied++;
      }
    }
    return applied;
  }

  return {
    add(pass) {
      passes.push(pass);
      return () => {
        const i = passes.indexOf(pass);
        if (i >= 0) passes.splice(i, 1);
      };
    },
    any: () => passes.length > 0,
    open() {
      if (collecting !== null || passes.length === 0) return false;
      collecting = { added: new Set(), removed: new Set(), posed: new Set(), reparented: new Set(), dataChanged: new Set() };
      return true;
    },
    note(kind, payload) {
      if (collecting !== null && !env.untracked()) noteInto(collecting, kind, payload);
    },
    run,
    abandon() {
      collecting = null;
    },
    op() {
      return {
        name: 'editPass',
        args: {},
        label: 'Edit pass',
        elideNoop: true,
        apply: () => (run() > 0 ? undefined : 'noop'),
        invert: () => NOOP,
      };
    },
  };
}
