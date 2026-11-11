// Typed-array and snapshot helpers shared by every editor app's localStorage persistence.
//
// A path keeps its commands and coords in typed arrays, which `JSON.stringify`
// writes as `{"0":1,"1":2,...}`. Saves tag them with `@weasel-js/geom`'s
// encoding; loads read the tags back, and also the untagged shapes older saves
// wrote, which is why the walk here is our own. A value of the consumer's that
// the load would take for one of those is written inside a `{ "__raw": … }`
// wrapper, which the load takes off and reads nothing into.

import type {
  AddNodeSpec, PagesDoc, PoseDescriptor, SceneRegistry, SavedScene, SpecsFromSerializedOptions,
} from '@weasel-js/core';
import { PAGES_DOC_KEY, adoptLegacyPages, asNodeId, sceneFromJSON, setPages, specsFromSerialized } from '@weasel-js/core';
import { isRawWrapper, typedArrayReplacerWrapping, untagTypedArray } from '@weasel-js/geom';

const isPathKey = (k: string): k is 'commands' | 'coords' => k === 'commands' || k === 'coords';

/** `JSON.stringify` replacer: tag typed arrays so they survive the round-trip, and wrap any other value
 *  {@link reviveTypedArrays} would read as something else, an older save's untagged path arrays included. */
export const serializeReplacer: (this: unknown, key: string, value: unknown) => unknown =
  typedArrayReplacerWrapping((key, value) => isPathKey(key) && legacyNumbers(value) !== undefined);

/** Walk a parsed snapshot and rebuild any tagged / numeric-key typed arrays in
 *  place. Returns the same node for call-site convenience, unless the node itself is one. */
export function reviveTypedArrays<T>(node: T): T {
  if (node == null || typeof node !== 'object') return node;
  if (isRawWrapper(node)) return reviveWithin(node.__raw) as T;
  const tagged = untagTypedArray(node);
  if (tagged) return tagged as unknown as T;
  return reviveWithin(node);
}

/** {@link reviveTypedArrays} on everything `node` holds, but not `node` itself. */
function reviveWithin<T>(node: T): T {
  if (node == null || typeof node !== 'object' || ArrayBuffer.isView(node)) return node;
  const obj = node as Record<string, unknown>;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const legacy = isPathKey(k) && !ArrayBuffer.isView(v) ? legacyNumbers(v) : undefined;
    obj[k] = legacy ? (k === 'commands' ? Uint8Array.from(legacy) : Float32Array.from(legacy)) : reviveTypedArrays(v);
  }
  return node;
}

const isLegacyNumber = (v: unknown): boolean => typeof v === 'number' || v === null;

/** A path's typed array as an older save wrote it, untagged: a plain array of numbers, or an object of
 *  them under the keys `0`, `1`, .... `null` is how JSON wrote a NaN. Anything else is not one. */
function legacyNumbers(v: unknown): number[] | undefined {
  if (Array.isArray(v)) return v.every(isLegacyNumber) ? v.map((n) => Number(n ?? 0)) : undefined;
  if (v === null || typeof v !== 'object') return undefined;
  const src = v as Record<string, unknown>;
  const keys = Object.keys(src);
  if (!keys.every((key, i) => key === String(i) && isLegacyNumber(src[key]))) return undefined;
  return keys.map((key) => Number(src[key] ?? 0));
}

/** How a snapshot is read: `specsFromSerialized`'s options; the pose descriptor that measures each root
 *  when a snapshot's roots are placed on their pages (default core's `placeOnPages` default); and the pages
 *  a snapshot with neither page nodes nor a `core:pages` value gets, one saved before its app had pages. */
export type SnapshotLoadOptions<TData, TLayer extends string, TPose> = SpecsFromSerializedOptions<TData, TLayer, TPose> & {
  descriptor?: PoseDescriptor<unknown>;
  pages?: PagesDoc;
};

/** Whether loading `json` with `opts` rebuilds its tree, its pages made nodes there and then: one saved with
 *  its pages as the `core:pages` value, or without pages when `opts.pages` gives some. An undo stack saved
 *  beside such a snapshot was recorded against a tree the load replaces, and would replay wrongly. */
export function snapshotRebuildsTree(
  json: Pick<SavedScene<unknown, string, unknown>, 'nodes' | 'doc'>,
  opts: { pages?: PagesDoc } = {},
): boolean {
  if (json.nodes.some((n) => (n as unknown) !== null && typeof n === 'object' && n.pageRun !== undefined)) return false;
  return json.doc?.[PAGES_DOC_KEY] !== undefined || opts.pages !== undefined;
}

/**
 * `json` with its pages as page nodes. A snapshot that {@link snapshotRebuildsTree} is built into a
 * scene, given its pages there by core's `adoptLegacyPages` from its `core:pages` value, else by
 * `setPages` from `opts.pages`, each root placed with `opts.descriptor`, and written out again. Any
 * other snapshot, a converted one included, comes back as it is. `registry` and `opts` are what the
 * load reads it with. The scene is built on the rigid composition unless `opts.composition` says
 * otherwise, so a scene on any other must pass its own.
 */
export function adoptSnapshotPages<TData, TLayer extends string, TPose>(
  json: SavedScene<TData, TLayer, TPose>,
  registry: SceneRegistry<TPose, TData, TLayer> = {},
  opts: SnapshotLoadOptions<TData, TLayer, TPose> = {},
): SavedScene<TData, TLayer, TPose> {
  if (!snapshotRebuildsTree(json as never, opts)) return json;
  const saved = json.doc?.[PAGES_DOC_KEY];
  if (saved !== undefined) checkPagesDoc(saved);
  const { descriptor, pages, ...read } = opts;
  const taken = new Set<unknown>(json.nodes.map((n) => (n as { id?: unknown } | null)?.id));
  let n = 0;
  // The run is the one node adoption mints; a fixed id loads the same snapshot the same way every time.
  const generateId = () => {
    let id = 'page-run';
    while (taken.has(id)) id = `page-run-${++n}`;
    taken.add(id);
    return asNodeId(id);
  };
  const scene = sceneFromJSON(json, { registry, unknownKeys: 'skip', generateId, ...read });
  const place = descriptor ? { descriptor } : {};
  if (!adoptLegacyPages(scene, place)) scene.untracked(() => setPages(scene, pages!, 'Adopt pages', place));
  return scene.toJSON();
}

/** Throws, saying what is wrong, on a saved `core:pages` value that is not a `PagesDoc`. */
function checkPagesDoc(value: unknown): void {
  const fail = (what: string): never => { throw new Error(`adoptSnapshotPages: the snapshot's ${PAGES_DOC_KEY} value ${what}`); };
  if (value === null || typeof value !== 'object') fail('is not an object');
  const { pages, layout } = value as { pages?: unknown; layout?: unknown };
  if (!Array.isArray(pages)) fail('has no list of pages');
  (pages as unknown[]).forEach((p, i) => {
    if (p === null || typeof p !== 'object') fail(`has page ${i} that is not an object`);
    const { id, width, height } = p as { id?: unknown; width?: unknown; height?: unknown };
    if (typeof id !== 'string') fail(`has page ${i} without a string id`);
    if (![width, height].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0)) fail(`has page "${String(id)}" without a finite size`);
  });
  if (layout !== undefined && (layout === null || typeof layout !== 'object' || Array.isArray(layout))) fail('has a layout that is not an object');
}

/** The document values a persisted snapshot carries, shaped for `useScene`'s `doc` option, or
 *  `undefined` for a snapshot written before it had any. A `core:pages` value is not among them:
 *  `nodeSpecsFromSnapshot` loads those pages as nodes (`adoptSnapshotPages`). */
export function docFromSnapshot<TData, TLayer extends string, TPose>(
  json: SavedScene<TData, TLayer, TPose>,
): Readonly<Record<string, unknown>> | undefined {
  const { doc } = json;
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) return undefined;
  if (!(PAGES_DOC_KEY in doc)) return doc;
  const { [PAGES_DOC_KEY]: _pages, ...rest } = doc;
  return rest;
}

/** Rebuild the full node list from a persisted scene snapshot, shaped for
 *  `useScene`'s `initial` option: core's `specsFromSerialized`, so every field
 *  a save writes comes back. A key `registry` lacks leaves the node without
 *  that function rather than failing the load, unless `opts.unknownKeys` says
 *  `'throw'`; `opts.onSkip` hears each. Pages saved as a `core:pages` value
 *  come back as page nodes, and a snapshot saved without pages gets
 *  `opts.pages` (`adoptSnapshotPages`). `revive` rewrites each node's data on
 *  the way in; the default revives typed arrays only. A scene composed other
 *  than rigidly passes its own `opts.composition`, since the pages are made in
 *  a scene built on it. */
export function nodeSpecsFromSnapshot<TData, TLayer extends string, TPose>(
  json: SavedScene<TData, TLayer, TPose>,
  registry: SceneRegistry<TPose, TData, TLayer> = {},
  revive: <T>(node: T) => T = reviveTypedArrays,
  opts: SnapshotLoadOptions<TData, TLayer, TPose> = {},
): AddNodeSpec<TData, TLayer, TPose>[] {
  const { descriptor: _descriptor, pages: _pages, ...read } = opts;
  return specsFromSerialized(adoptSnapshotPages(json, registry, opts), registry, { unknownKeys: 'skip', ...read })
    .map((spec) => ({ ...spec, data: revive(spec.data) }));
}
