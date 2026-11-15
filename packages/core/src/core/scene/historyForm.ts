import type { HistoryRestoreReport, RestoreOptions, SerializedHistory, SerializedOp } from '@weasel-js/history';
import type { OpRegistry } from 'core/ops/registry';

/** The form a scene's undo entries are recorded in. A serialized history
 *  carries it, and one carrying another is not restored. Form 4 records a
 *  child's pose in its container's frame; form 3 named nodes `mark` and
 *  `group`; form 2 held the scene's own ops for every edit, and before it an
 *  `applyBatch` entry held the ops it was given. */
export const SCENE_HISTORY_FORM = 4;

/** What `Scene.serializeHistory` answers with. */
export interface SerializedSceneHistory extends SerializedHistory {
  form: typeof SCENE_HISTORY_FORM;
}

/** The scene's members that save and restore its undo/redo history. */
export interface SceneHistoryPersistence {
  /** Snapshot the undo/redo history in a JSON-serializable form (the
   *  engine's `SerializedHistory`, marked with the scene's recorded form).
   *  An entry holds the scene's own ops, whichever way the edit was made.
   *  An op handed to `applyBatch` that wrote no scene state is held as
   *  itself, and an entry with a nameless one is dropped. Payload
   *  JSON-safety (e.g. typed arrays inside poses) is the caller's concern.
   *  Do not call mid-`batch` — the open batch's ops are not yet recorded. */
  serializeHistory(): SerializedSceneHistory;
  /** Replace the undo/redo history from a `serializeHistory()` snapshot.
   *  Call on a scene whose node/layer state already matches the snapshot's
   *  head state (i.e. right after `loadState` from the paired scene
   *  snapshot); node state is NOT mutated. Kinds registered via `registerOp`
   *  rebuild as the scene's own ops. Any other op is an external one, handed
   *  to `applyBatch`, and rebuilds through {@link opRegistry} bound to the
   *  `setHistoryAdapter` accessor, which must be set before this call.
   *
   *  Strict by default: an op nothing rebuilds, an external op with no
   *  history adapter set, or a snapshot not in the current recorded form (see
   *  `SCENE_HISTORY_FORM`) throws `HistoryRestoreError`, whose `report` lists
   *  them, and leaves the history as it was. A restored external op that then
   *  fails on undo or redo throws `RestoredOpError`, leaving its entry and the
   *  state where they were. With `recovery: 'best-effort'`, each op it cannot
   *  rebuild becomes a placeholder that changes nothing, a wrong-form snapshot
   *  is dropped, and the report says which; `onSkip` hears each op an undo or
   *  redo steps past.
   *
   *  Restored entries never coalesce with new ones. Notifies once. Do not
   *  call mid-`batch`: the stacks are replaced underneath the open batch,
   *  whose eventual flush would graft onto (and evict against) the restored
   *  stacks. */
  restoreHistory(snapshot: SerializedHistory, options?: RestoreOptions): HistoryRestoreReport;
  /** Install (or clear with `null`) the accessor for the adapter that
   *  RESTORED external ops apply against on undo/redo: the ops handed to
   *  `applyBatch` that wrote no scene state, such as a selection change,
   *  rebuilt from a `restoreHistory` snapshot. Read at each apply. Live
   *  `applyBatch` entries are unaffected (they bind their call-site
   *  adapter). */
  setHistoryAdapter(fn: (() => unknown) | null): void;
  /** Where this scene's restored external ops find their factories. See
   *  `SceneOptions.opRegistry`. */
  readonly opRegistry: OpRegistry;
}

/** The scene's member that applies another scene's edits. */
export interface SceneReplay {
  /** Apply ops another scene recorded, given as their `name` and `args`: the
   *  `applied` ops of each entry its `history.observe` reports, an undo's
   *  `revert:` inverses included. They rebuild as `restoreHistory` rebuilds a
   *  snapshot's, so a kind taught with `registerOp` must be registered here too.
   *
   *  Nothing is recorded: the history is left as it was, apart from a `seal`
   *  so no later edit coalesces across the change, and its `observe` reports
   *  nothing. So every step `history.observe` reports is an edit made on this
   *  scene, and a sync layer can forward all of them without echoing back what
   *  it received. Subscribers are notified once, as for any edit.
   *
   *  All or nothing: when an op throws, as one addressing a node this scene
   *  does not hold does, the ops before it are taken back and the throw
   *  propagates, which tells the caller the two scenes have diverged. Throws
   *  on an unknown name before applying anything, and inside any other edit. */
  replay(ops: readonly SerializedOp[]): void;
}
