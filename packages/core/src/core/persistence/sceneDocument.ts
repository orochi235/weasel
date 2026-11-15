/**
 * A scene document as one JSON value: the encoded scene, and its undo history paired with it. A history is recorded
 * against one tree, so it carries a fingerprint of the scene it was saved with, and it restores only onto a scene
 * whose state has that fingerprint: never over a different document, a tree a load rebuilt, or content an
 * application migration rewrote.
 */
import type { HistoryRestoreReport, RestoreOptions } from '@weasel-js/history';
import { SCENE_HISTORY_FORM, type SerializedSceneHistory } from '../scene/historyForm';
import type { SavedScene, SerializedScene } from '../scene/serializedTypes';
import { SnapshotShapeError, assertSnapshotShape } from '../scene/snapshotShape';
import { decodeSnapshot, stringifySnapshot, type Encoded } from './codec';

/** What a {@link SceneDocumentEnvelope} names its format. */
export const SCENE_DOCUMENT_FORMAT = 'weasel/scene-document';

/** The envelope's own version, apart from the scene's (`SerializedScene.version`) and the history's
 *  (`SCENE_HISTORY_FORM`). */
export const SCENE_DOCUMENT_VERSION = 1;

/** An undo history encoded with the fingerprint of the scene it was saved beside. */
export interface PairedHistory {
  /** The {@link sceneFingerprint} of the scene whose state the history's head is. */
  scene: string;
  history: Encoded<SerializedSceneHistory>;
}

/** A scene and, optionally, its paired history, as one JSON value. */
export interface SceneDocumentEnvelope<TData, TLayer extends string, TPose> {
  format: typeof SCENE_DOCUMENT_FORMAT;
  version: typeof SCENE_DOCUMENT_VERSION;
  scene: Encoded<SerializedScene<TData, TLayer, TPose>>;
  history?: PairedHistory;
}

/** A decoded {@link SceneDocumentEnvelope}: the scene ready to load, and its history still encoded, since it is
 *  checked against the scene it restores onto ({@link restorePairedHistory}). */
export interface SceneDocument<TData, TLayer extends string, TPose> {
  scene: SavedScene<TData, TLayer, TPose>;
  history?: PairedHistory;
}

/** What a scene's persistence reads and writes. */
export interface PersistedScene<TData, TLayer extends string, TPose> {
  toJSON(): SerializedScene<TData, TLayer, TPose>;
  serializeHistory(): SerializedSceneHistory;
  restoreHistory(snapshot: SerializedSceneHistory, options?: RestoreOptions): HistoryRestoreReport;
}

/** How {@link restorePairedHistory} went: restored, with the scene's restore report; not a paired history at all
 *  (none, or one saved unpaired); paired with a scene whose state differs from this one; or recorded in a form this
 *  build does not replay. */
export type HistoryRestore =
  | { status: 'restored'; report: HistoryRestoreReport }
  | { status: 'unpaired' | 'mismatched' | 'stale' };

/** A fingerprint of encoded text: its length and a 53-bit hash of it. */
function fingerprintText(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return `${text.length.toString(36)}.${hash.toString(36)}`;
}

/** A fingerprint of `snapshot`'s state: equal for two snapshots that encode to the same JSON. */
export const sceneFingerprint = (snapshot: SerializedScene<unknown, string, unknown>): string =>
  fingerprintText(stringifySnapshot(snapshot));

const pairOf = (text: string, history: SerializedSceneHistory): PairedHistory =>
  ({ scene: fingerprintText(text), history: JSON.parse(stringifySnapshot(history)) as Encoded<SerializedSceneHistory> });

/** `scene`'s undo history, encoded and paired with its current state. Do not call mid-`batch`. */
export function pairHistory(scene: Omit<PersistedScene<unknown, string, unknown>, 'restoreHistory'>): PairedHistory {
  return pairOf(stringifySnapshot(scene.toJSON()), scene.serializeHistory());
}

/** `scene` as a document envelope, with its history paired unless `opts.history` is `false`. The scene is encoded
 *  once, for both. Do not call mid-`batch`. */
export function encodeSceneDocument<TData, TLayer extends string, TPose>(
  scene: Omit<PersistedScene<TData, TLayer, TPose>, 'restoreHistory'>,
  opts: { history?: boolean } = {},
): SceneDocumentEnvelope<TData, TLayer, TPose> {
  const text = stringifySnapshot(scene.toJSON());
  const envelope: SceneDocumentEnvelope<TData, TLayer, TPose> = {
    format: SCENE_DOCUMENT_FORMAT,
    version: SCENE_DOCUMENT_VERSION,
    scene: JSON.parse(text) as Encoded<SerializedScene<TData, TLayer, TPose>>,
  };
  if (opts.history !== false) envelope.history = pairOf(text, scene.serializeHistory());
  return envelope;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isPaired = (v: unknown): v is PairedHistory => isRecord(v) && typeof v.scene === 'string' && isRecord(v.history);

/** The document `value` encodes, as `JSON.parse` reads an envelope's text. Throws a `SnapshotShapeError` on a value
 *  that is not an envelope of this version, or whose scene is malformed; a `history` that is not a paired one is
 *  left out. The scene's own older versions are read as `sceneFromJSON` reads them. */
export function decodeSceneDocument<TData, TLayer extends string, TPose>(
  value: unknown,
): SceneDocument<TData, TLayer, TPose> {
  const refuse = (what: string): never => { throw new SnapshotShapeError(`Scene document: ${what}`); };
  if (!isRecord(value) || value.format !== SCENE_DOCUMENT_FORMAT) refuse(`not a ${SCENE_DOCUMENT_FORMAT} envelope`);
  const { version, scene, history } = value as Record<string, unknown>;
  if (version !== SCENE_DOCUMENT_VERSION) refuse(`unsupported version ${String(version)}; version ${SCENE_DOCUMENT_VERSION} is supported`);
  const decoded = decodeSnapshot(scene);
  assertSnapshotShape(decoded);
  return { scene: decoded as SavedScene<TData, TLayer, TPose>, ...(isPaired(history) ? { history } : {}) };
}

/**
 * Restores the history `paired` holds onto `scene`, only when `scene`'s state is the one it was saved beside: call it
 * once the paired snapshot has loaded, and after any application migration of the loaded data, since a migration
 * that changed the content leaves a history whose ops would write the old content back. Anything else leaves the
 * history as it was and says why. `paired` is the value as it was stored, so an older unpaired history reads as
 * `'unpaired'`. `options` are `Scene.restoreHistory`'s: strict by default, so a paired history naming an op this
 * scene cannot rebuild throws `HistoryRestoreError` and is not restored.
 */
export function restorePairedHistory(
  scene: PersistedScene<unknown, string, unknown>,
  paired: unknown,
  options?: RestoreOptions,
): HistoryRestore {
  if (!isPaired(paired)) return { status: 'unpaired' };
  if (paired.scene !== sceneFingerprint(scene.toJSON())) return { status: 'mismatched' };
  const history = decodeSnapshot(paired.history);
  if (history.form !== SCENE_HISTORY_FORM) return { status: 'stale' };
  return { status: 'restored', report: scene.restoreHistory(history, options) };
}
