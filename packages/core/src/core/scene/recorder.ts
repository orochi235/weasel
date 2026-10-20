/**
 * How a scene mutation becomes an undo entry: recorded on its own, collected
 * into the batch it runs in, or left to the engine or the untracked run that
 * is driving it.
 */
import type { History } from '@weasel-js/history';
import type { Op } from 'core/ops/types';
import type { AppliedLog } from './appliedLog';
import type { ArrivalWindow } from './arrivalWindow';
import { bindOpToAdapter } from './boundOps';
import type { EditMode } from './editMode';
import type { EditPasses } from './editPass';
import type { Notifier } from './notifier';
import type { NodeId } from './types';

/** What the recorder needs from the scene it records for. */
export interface RecorderEnv {
  notifier: Notifier;
  mode: EditMode;
  /** The scene's own undo/redo engine. */
  engine: History;
  /** Apply a registered op's forward half. */
  runOp(kind: string, payload: unknown): void;
  /** A registered op as the engine holds it. */
  makeOp(kind: string, payload: unknown): Op;
  log: AppliedLog;
  arrivals: Pick<ArrivalWindow<unknown>, 'bareLayoutEdit' | 'open' | 'settle' | 'emitReflow' | 'abandon'>;
  passes: Pick<EditPasses, 'any' | 'open' | 'note' | 'run' | 'abandon'>;
  selection(): readonly NodeId[];
  /** Write one pose an arrival settle decided. */
  writePose(id: string, pose: unknown): void;
  /** Run `fn` as an edit made by a scene call labeled `label`. */
  labeled<T>(label: string, via: 'call', fn: () => T): T;
}

export interface Recorder {
  /** Apply a registered op as part of whatever edit is running. */
  record(kind: string, payload: unknown, label: string): void;
  /** Run the recording half of a mutation. One that touches a laid-out
   *  container, called bare, runs as a batch of its own: that is what puts
   *  the arrangement it triggers in the same undo step. */
  edit<T>(label: string, touchesLayout: boolean, fn: () => T): T;
  batch<T>(label: string, fn: () => T): T;
  untracked<T>(fn: () => T): T;
  /** Whether an edit made now would join an open `batch`'s entry. */
  joins(): boolean;
  /** Apply ops built outside the scene as part of the open `batch`, all or
   *  none. Its entry holds the kit ops they cause, and beside them, bound to
   *  `adapter`, any op that wrote no scene state. */
  join(ops: Op[], adapter: unknown): void;
  /** Run `step`, and answer with the kit ops applied during it. */
  capturing<T>(step: () => T): { result: T; ops: Op[] };
  /** Run `fn` as a history engine's step: the ops it applies may re-enter
   *  scene mutation methods, which apply but do not record. The caller
   *  notifies once after. */
  engineDriven<T>(fn: () => T): T;
}

/** Take back ops that wrote outside the scene, newest first. The scene's own
 *  writes are reverted by the applied log. */
function unwind(outer: readonly Op[]): void {
  for (let i = outer.length - 1; i >= 0; i--) {
    try {
      outer[i].invert().apply(undefined);
    } catch {
      // The throw being unwound is the one the caller sees.
    }
  }
}

export function createRecorder(env: RecorderEnv): Recorder {
  const { notifier, mode, engine, log, arrivals, passes } = env;
  /** The outermost open batch, while it is recording. */
  let collecting: { label: string; ops: Op[]; outer: Op[]; selectionBefore: readonly NodeId[] } | null = null;
  /** The kit ops applied since the innermost `capturing` opened. */
  let captured: Op[] | null = null;

  /** `fn`, then the poses its arrivals settle to and its passes' ops, for whichever this edit owns. */
  function withArrivalsSettled<T>(fn: () => T, owns: boolean, ownsPasses = false): T {
    const result = fn();
    if (owns) for (const p of arrivals.settle()) env.writePose(p.id, p.to);
    if (ownsPasses) passes.run();
    return result;
  }

  function batch<T>(label: string, fn: () => T): T {
    const outermost = !mode.open();
    // Captured at open, not at recordEntry: by the time the batch closes
    // the selection has already moved to wherever the batch put it.
    if (outermost) collecting = { label, ops: [], outer: [], selectionBefore: env.selection() };
    const ownsArrivals = outermost && arrivals.open(true);
    const ownsPasses = outermost && passes.open();
    return env.labeled(label, 'call', () => notifier.deferred(() => mode.during('batch', () => {
      if (!outermost) return fn();
      try {
        const result = log.atomically(
          () => withArrivalsSettled(fn, ownsArrivals, ownsPasses),
          () => (collecting?.ops.length ?? 0) > 0,
        );
        if (ownsArrivals) arrivals.emitReflow();
        return result;
      } catch (err) {
        // Reverted already; the half-built entry must not reach history.
        unwind(collecting?.outer ?? []);
        collecting = null;
        throw err;
      }
    }), () => {
      if (ownsArrivals) arrivals.abandon();
      if (ownsPasses) passes.abandon();
      if (!outermost || !collecting) return;
      const finished = collecting;
      collecting = null;
      // The ops were applied as they were issued, so the entry is pushed
      // without re-applying.
      if (finished.ops.length > 0) {
        engine.recordEntry(finished.ops, finished.label, { selectionBefore: finished.selectionBefore });
      }
    }));
  }

  function record(kind: string, payload: unknown, label: string): void {
    // While passes listen, a bare edit is a batch of its own, so their ops land in its entry.
    if (mode.records() && !collecting && passes.any()) return void batch(label, () => record(kind, payload, label));
    passes.note(kind, payload);
    env.labeled(label, 'call', () => {
      if (mode.records() && !collecting) {
        // The engine applies the op itself, which is what lets it coalesce.
        mode.during('own', () => engine.applyOps([env.makeOp(kind, payload)], label));
      } else {
        env.runOp(kind, payload);
        log.logApplied(kind, payload);
        if (mode.records()) collecting!.ops.push(env.makeOp(kind, payload));
        else if (!mode.untracked()) captured?.push(env.makeOp(kind, payload));
      }
    });
    notifier.notify();
  }

  return {
    record,
    edit: (label, touchesLayout, fn) => (touchesLayout && arrivals.bareLayoutEdit() ? batch(label, fn) : fn()),
    batch,
    untracked(fn) {
      const versionBefore = notifier.version();
      const ownsArrivals = arrivals.open(true);
      return notifier.deferred(() => mode.during('untracked', () => {
        const result = log.atomically(() => withArrivalsSettled(fn, ownsArrivals), () => false);
        if (ownsArrivals) arrivals.emitReflow();
        return result;
      }), () => {
        if (ownsArrivals) arrivals.abandon();
        if (notifier.version() !== versionBefore) engine.seal();
      });
    },
    joins: () => mode.records() && collecting !== null,
    join(ops, adapter) {
      const into = collecting!;
      const mark = into.ops.length;
      const outer: Op[] = [];
      try {
        log.atomically(() => {
          for (const op of ops) {
            const before = into.ops.length;
            const result = op.apply(adapter);
            if (into.ops.length > before || result === false || result === 'noop') continue;
            outer.push(bindOpToAdapter(op, adapter));
            into.ops.push(outer[outer.length - 1]);
          }
        }, () => false);
      } catch (err) {
        unwind(outer);
        into.ops.length = mark;
        throw err;
      }
      into.outer.push(...outer);
    },
    capturing(step) {
      const enclosing = captured;
      const ops: Op[] = [];
      captured = ops;
      try {
        return { result: step(), ops };
      } finally {
        captured = enclosing;
      }
    },
    engineDriven: (fn) => mode.during('engine', () => notifier.muted(fn)),
  };
}
