/**
 * How a scene's edits reach its undo stack: the op table, the log that takes
 * back an edit refused partway, the engine, and the recorder between them.
 */
import type { Journal } from '@weasel-js/history';
import type { Op } from 'core/ops/types';
import { createHistory } from 'core/ops/createHistory';
import { createAppliedLog } from './appliedLog';
import type { ArrivalWindow } from './arrivalWindow';
import type { EditMode } from './editMode';
import { createEditPasses } from './editPass';
import { createSceneHistory, type SceneHistoryMethods } from './historyFacade';
import type { Notifier } from './notifier';
import type { PoseWriteLog } from './poseWrites';
import { createOpTable, type OpTable } from './opTable';
import { createOuterOps } from './outerOps';
import { createRecorder, type Recorder, type RecorderEnv } from './recorder';
import type { SceneSelection } from './sceneSelection';
import type { StaleReplay } from './staleReplay';
import type { NodeId, RegisteredOp, Scene } from './types';

export interface SceneRecordingEnv {
  notifier: Notifier;
  mode: EditMode;
  stale: StaleReplay;
  /** Run with the lock guard lifted. */
  lifted<T>(fn: () => T): T;
  selection: Pick<SceneSelection, 'get' | 'set' | 'replace'>;
  arrivals: RecorderEnv['arrivals'] & Pick<ArrivalWindow<unknown>, 'runEdit'>;
  /** The adapter an edit pass's ops apply through. */
  passAdapter(): unknown;
  writePose(id: string, pose: unknown): void;
  poseWrites: Pick<PoseWriteLog<unknown>, 'labeled' | 'replaying'>;
  config: {
    getActiveJournal?: (() => Journal | null) | undefined;
    coalesceWindowMs?: number | undefined;
    historyLimit?: number | undefined;
  };
}

export interface SceneRecording {
  ops: Pick<OpTable, 'register' | 'run'>;
  recorder: Recorder;
  clearHistory(): void;
  methods: SceneHistoryMethods & Pick<
    Scene<unknown, string, unknown>,
    | 'registerOp' | 'recordOp' | 'applyBatch' | 'history' | 'batch' | 'untracked'
    | 'setActiveJournalAccessor' | 'setHistoryAdapter' | 'addEditPass'
  >;
}

export function createSceneRecording(env: SceneRecordingEnv): SceneRecording {
  const { notifier, mode, stale, lifted, selection, arrivals, config, poseWrites } = env;
  const { notify } = notifier;
  const passes = createEditPasses({ adapter: env.passAdapter, untracked: mode.untracked });

  /** Run an op-driven edit with its arrivals settled and its passes run at
   *  its end, in the same entry, when this call owns them. */
  const runEdit = (ops: Op[], run: (ops: Op[]) => void): boolean => arrivals.runEdit(ops, (all) => {
    if (!passes.open()) return run(all);
    try {
      run([...all, passes.op()]);
    } finally {
      passes.abandon();
    }
  });

  const ops = createOpTable({
    driven: mode.open,
    replayAlone: (step) => { replay(step); notify(); },
    skips: stale.skips,
    // Only a replay is logged: a first apply is recorded by the entry it
    // creates, and reverting it would leave that entry describing nothing.
    applied: (kind, payload, reverted) => { if (!mode.records()) logApplied(kind, payload, reverted); },
  });

  const outer = createOuterOps({
    own: (name, args) => (ops.handlers.has(name) ? ops.op(name, args) : null),
    recorder: () => recorder,
    // Deferred rather than muted, so a throwing op cannot strand subscribers
    // after earlier ops in the batch already mutated state.
    driving: (step) => notifier.deferred(() => mode.during('engine', () => atomically(step, () => true))),
    getActiveJournal: config.getActiveJournal ?? null, openJournal: () => openJournal(),
  });

  // The scene's undo/redo engine. Its recorded ops close over their payloads,
  // so the engine's adapter argument is unused.
  const engine = createHistory(undefined, {
    selection: { get: selection.get, set: (ids) => selection.set(ids as readonly NodeId[]) },
    ...(config.coalesceWindowMs !== undefined ? { coalesceWindowMs: config.coalesceWindowMs } : {}),
    ...(config.historyLimit !== undefined ? { historyLimit: config.historyLimit } : {}),
    rebuildOp: outer.rebuild,
  });

  const log = createAppliedLog({
    registered: ops.handlers,
    lifted,
    getSelection: selection.get,
    setSelection: selection.replace,
    notify,
  });
  const { atomically, logApplied } = log;

  const recorder = createRecorder({
    notifier,
    mode,
    engine,
    runOp: ops.run,
    makeOp: ops.op,
    log,
    arrivals,
    passes,
    selection: selection.get,
    writePose: env.writePose,
    labeled: poseWrites.labeled,
  });
  const { record, engineDriven } = recorder;

  /** Run an engine step that replays recorded ops — undo, redo, goto, a
   *  journal stepping. The engine inverts whole ops when one throws; this
   *  also reverts the scene writes of the op that threw partway. */
  function replay(step: () => void): void {
    poseWrites.replaying(() => atomically(() => lifted(() => stale.during(() => engineDriven(step))), () => true));
  }

  function refuseUntracked(verb: string): void {
    if (mode.untracked()) throw new Error(`Scene: cannot ${verb} inside untracked() — it records`);
  }

  const { history, methods, openJournal } = createSceneHistory({
    engine,
    applying: (step) => atomically(() => engineDriven(step), () => true),
    causing: outer.causing,
    replay,
    notify,
    refuseUntracked,
    runArrivalEdit: runEdit,
    labeled: (label, fn) => poseWrites.labeled(label, 'ops', fn),
    activeJournal: outer.activeJournal,
  });

  return {
    ops,
    recorder,
    clearHistory: () => engine.clear(),
    methods: {
      registerOp(kind, handler) {
        if (kind.startsWith('kit:')) {
          throw new Error(`Scene: op kind "${kind}" is reserved (kit:* prefix)`);
        }
        ops.register(kind, handler as RegisteredOp<unknown>);
      },
      recordOp(op) {
        record(op.kind, op.payload, op.kind);
      },
      applyBatch(batch, label, adapter) {
        refuseUntracked('applyBatch');
        return poseWrites.labeled(label, 'ops', () =>
          runEdit(batch, (all) => outer.apply(engine, all, label, adapter)));
      },
      history,
      ...methods,
      batch: recorder.batch,
      untracked: recorder.untracked,
      setActiveJournalAccessor: outer.setActiveJournalAccessor,
      setHistoryAdapter: outer.setHistoryAdapter,
      addEditPass: passes.add,
    },
  };
}
