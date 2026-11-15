/**
 * Part of the `@weasel-js/core` barrel. The canonical JSON codec for snapshots, and the document envelope that
 * pairs a scene with its undo history.
 *
 * @packageDocumentation
 */
export {
  decodeSnapshot, encodeSnapshot, parseSnapshot, snapshotReplacer, stringifySnapshot,
} from '../core/persistence/codec';
export type { Encoded, SnapshotText } from '../core/persistence/codec';
export {
  SCENE_DOCUMENT_FORMAT, SCENE_DOCUMENT_VERSION, decodeSceneDocument, encodeSceneDocument, pairHistory,
  restorePairedHistory, sceneFingerprint,
} from '../core/persistence/sceneDocument';
export type {
  HistoryRestore, PairedHistory, PersistedScene, SceneDocument, SceneDocumentEnvelope,
} from '../core/persistence/sceneDocument';
