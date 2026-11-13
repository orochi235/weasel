import type { SerializedHistory } from '@weasel-js/history';

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
   *  snapshot); node state is NOT mutated. Ops re-registered via
   *  `registerOp` before this call round-trip; unknown kinds become no-op
   *  placeholders; external ops rebuild via the global op-factory registry
   *  and replay against the `setHistoryAdapter` accessor. Restored entries
   *  never coalesce with new ones. Notifies once. A snapshot that is not in
   *  the current recorded form (see `SCENE_HISTORY_FORM`) is dropped:
   *  the history is left as it was. Do not call mid-`batch`:
   *  the stacks are replaced underneath the open batch, whose eventual
   *  flush would graft onto (and evict against) the restored stacks. */
  restoreHistory(snapshot: SerializedHistory): void;
  /** Install (or clear with `null`) the accessor for the adapter that
   *  RESTORED external ops apply against on undo/redo: the ops handed to
   *  `applyBatch` that wrote no scene state, such as a selection change,
   *  rebuilt from a `restoreHistory` snapshot. Resolved lazily at each
   *  apply, so wiring order relative to `restoreHistory` doesn't matter.
   *  Live `applyBatch` entries are unaffected (they bind their call-site
   *  adapter). If unset when a restored op applies, the op is a debug-warned
   *  no-op. */
  setHistoryAdapter(fn: (() => unknown) | null): void;
}
