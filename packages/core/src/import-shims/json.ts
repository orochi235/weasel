// `@weasel-js/core/json` — JSON helpers and the snapshot codec, with no React and no stylesheet in the import
// graph, for a Node process (a vite plugin, a headless renderer) that cannot load the barrel. The document
// envelope is not here: it is typed against the scene, whose types reach React.
export { stableStringify } from 'core/stableStringify';
export {
  decodeSnapshot, encodeSnapshot, parseSnapshot, snapshotReplacer, stringifySnapshot,
} from 'core/persistence/codec';
export type { Encoded, SnapshotText } from 'core/persistence/codec';
