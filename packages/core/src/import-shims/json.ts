// `@weasel-js/core/json` — JSON helpers and the snapshot codec, with no React and no stylesheet in the import
// graph, for a Node process (a vite plugin, a headless renderer) that cannot load the barrel.
export { stableStringify } from 'core/stableStringify';
export * from '../barrel/persistence';
