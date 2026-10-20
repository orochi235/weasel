/**
 * Scene edit passes: functions that hear what a live edit did, once its own
 * mutations and the arrival handler have run, and answer with ops that join
 * the same undo entry.
 *
 * Passes run by ascending order, and each hears the edit's own changes plus
 * every write the passes before it made. A pass still runs once per edit, so
 * none re-triggers itself or another. Undo, redo, and history replays never
 * run passes: they restore an edit whose passes already ran.
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
  /** The document-value keys (`scene.doc`) set. */
  docChanged: ReadonlySet<string>;
}

/** Where a pass runs among the others. */
export interface SceneEditPassOptions {
  /** Passes run by ascending order, ties in the order they were added.
   *  Default 0. */
  order?: number;
}

/** A scene edit pass: the ops `summary`'s edit also makes, or null for none. */
export type SceneEditPass = (summary: SceneEditSummary) => readonly Op[] | null;

/** The scene's edit-pass member. */
export interface SceneEditPasses {
  /** Add a pass that hears each live edit once its own mutations and the
   *  arrival handler have run, and answers with ops that join the same undo
   *  entry. A bare scene call runs as an edit of its own while any pass is
   *  added. A pass hears what the passes ordered before it wrote, never what
   *  it or a later one writes, and undo, redo, and history replays never run
   *  it. Returns the pass's remover. */
  addEditPass(pass: SceneEditPass, opts?: SceneEditPassOptions): () => void;
}

/** What the passes need from the scene they serve. */
export interface EditPassEnv {
  /** The adapter a pass's ops apply through. */
  adapter(): unknown;
  /** Whether an edit made now is untracked, and so not summarized. */
  untracked(): boolean;
}

export interface EditPasses {
  /** Add a pass after every one of its order or lower. Returns its remover. */
  add(pass: SceneEditPass, opts?: SceneEditPassOptions): () => void;
  /** Whether any pass is installed. */
  any(): boolean;
  /** Start summarizing an edit when a pass is installed and no enclosing edit
   *  is summarizing already; true when this caller now owns the summary. */
  open(): boolean;
  /** Note what a live kit op is about to write. */
  note(kind: string, payload: unknown): void;
  /** Run every pass in order, each over the summary as it stands at its
   *  turn, applying its ops into that summary; then close it. Answers how
   *  many ops applied. */
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
  docChanged: Set<string>;
}

const emptyCollecting = (): Collecting => ({
  added: new Set(), removed: new Set(), posed: new Set(), reparented: new Set(), dataChanged: new Set(), docChanged: new Set(),
});

const snapshot = (c: Collecting): SceneEditSummary => ({
  added: new Set(c.added),
  removed: new Set(c.removed),
  posed: new Set(c.posed),
  reparented: new Set(c.reparented),
  dataChanged: new Set(c.dataChanged),
  docChanged: new Set(c.docChanged),
});

const NOOP: Op = { name: 'editPass', args: {}, elideNoop: true, apply: () => 'noop', invert: () => NOOP };

/** Note one kit op's ids into `into`. */
function noteInto(into: Collecting, kind: string, payload: unknown): void {
  const p = payload as { id?: NodeId; key?: string; nodes?: readonly { id: NodeId }[]; fromParent?: NodeId | null; toParent?: NodeId | null };
  switch (kind) {
    case 'kit:add': into.added.add(p.id!); break;
    case 'kit:remove': for (const n of p.nodes ?? []) into.removed.add(n.id); break;
    case 'kit:setPose': into.posed.add(p.id!); break;
    case 'kit:setData': into.dataChanged.add(p.id!); break;
    case 'kit:setDoc': into.docChanged.add(p.key!); break;
    case 'kit:move': if (p.fromParent !== p.toParent) into.reparented.add(p.id!); break;
    default: break;
  }
}

export function createEditPasses(env: EditPassEnv): EditPasses {
  /** Sorted by order; equal orders keep the order they were added in. */
  const passes: { pass: SceneEditPass; order: number }[] = [];
  let collecting: Collecting | null = null;

  function run(): number {
    const summary = collecting;
    if (summary === null) return 0;
    let applied = 0;
    try {
      for (const { pass } of [...passes]) {
        const ops = pass(snapshot(summary));
        if (ops === null) continue;
        const adapter = env.adapter();
        for (const op of ops) {
          op.apply(adapter);
          applied++;
        }
      }
    } finally {
      collecting = null;
    }
    return applied;
  }

  return {
    add(pass, opts) {
      const entry = { pass, order: opts?.order ?? 0 };
      const at = passes.findIndex((p) => p.order > entry.order);
      passes.splice(at < 0 ? passes.length : at, 0, entry);
      return () => {
        const i = passes.indexOf(entry);
        if (i >= 0) passes.splice(i, 1);
      };
    },
    any: () => passes.length > 0,
    open() {
      if (collecting !== null || passes.length === 0) return false;
      collecting = emptyCollecting();
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
