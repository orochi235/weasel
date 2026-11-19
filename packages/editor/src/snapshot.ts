// Snapshot readers shared by every editor app's session persistence. Each takes a decoded snapshot, as core's
// `decodeSnapshot` or `parseSnapshot` returns one: encoding is core's codec, and nothing here reads JSON.

import type {
  AddNodeSpec, PagesDoc, PoseDescriptor, SceneRegistry, SavedScene, SpecsFromSerializedOptions, SystemLayerSpec,
  UseSceneOptions,
} from '@weasel-js/core';
import {
  PAGES_DOC_KEY, adoptLegacyPages, asNodeId, createScene, sceneFromJSON, setPages, specsFromSerialized,
} from '@weasel-js/core';
import { freshId, isFiniteNumber } from '@weasel-js/registry';

/** How a snapshot is read: `specsFromSerialized`'s options; the pose descriptor that measures each root
 *  when a snapshot's roots are placed on their pages (default core's `placeOnPages` default); and the pages
 *  a snapshot with neither page nodes nor a `core:pages` value gets, one saved before its app had pages. */
export type SnapshotLoadOptions<TData, TLayer extends string, TPose> = SpecsFromSerializedOptions<TData, TLayer, TPose> & {
  descriptor?: PoseDescriptor<unknown>;
  pages?: PagesDoc;
  /** The layers of the scene the specs are for. Given, the specs are built into a scene of them, which throws on a
   *  node that scene cannot hold: one on a layer it lacks, or under a parent the snapshot does not have. */
  systemLayers?: readonly SystemLayerSpec<TLayer>[];
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
  const { descriptor, pages, systemLayers: _layers, ...read } = opts;
  const taken = new Set<unknown>(json.nodes.map((n) => (n as { id?: unknown } | null)?.id));
  // The run is the one node adoption mints; a fixed id loads the same snapshot the same way every time.
  const generateId = () => {
    const id = freshId('page-run', taken, { bare: true });
    taken.add(id);
    return asNodeId(id);
  };
  const scene = sceneFromJSON(json, { registry, unknownKeys: 'skip', generateId, ...read });
  const place = descriptor ? { descriptor } : {};
  if (!adoptLegacyPages(scene, place)) scene.untracked(() => setPages(scene, pages!, { ...place, label: 'Adopt pages' }));
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
    if (![width, height].every((n) => isFiniteNumber(n) && n >= 0)) fail(`has page "${String(id)}" without a finite size`);
  });
  if (layout !== undefined && (layout === null || typeof layout !== 'object' || Array.isArray(layout))) fail('has a layout that is not an object');
}

/** The document values a decoded snapshot carries, shaped for `useScene`'s `doc` option, or
 *  `undefined` for a snapshot written before it had any. Each is a copy, so `json` is left as it is. A `core:pages` value is
 *  not among them: `nodeSpecsFromSnapshot` loads those pages as nodes (`adoptSnapshotPages`). */
export function docFromSnapshot<TData, TLayer extends string, TPose>(
  json: SavedScene<TData, TLayer, TPose>,
): Readonly<Record<string, unknown>> | undefined {
  const { doc } = json;
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) return undefined;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(doc)) {
    if (key === PAGES_DOC_KEY) continue;
    const value = copyPlain((doc as Record<string, unknown>)[key]);
    Object.defineProperty(out, key, { value, enumerable: true, writable: true, configurable: true });
  }
  return out;
}

/** Rebuild the full node list from a decoded scene snapshot, shaped for
 *  `useScene`'s `initial` option: core's `specsFromSerialized`, so every field
 *  a save writes comes back. A key `registry` lacks leaves the node without
 *  that function rather than failing the load, unless `opts.unknownKeys` says
 *  `'throw'`; `opts.onSkip` hears each. Pages saved as a `core:pages` value
 *  come back as page nodes, and a snapshot saved without pages gets
 *  `opts.pages` (`adoptSnapshotPages`). With `opts.systemLayers`, a snapshot the scene cannot hold throws here,
 *  where a reader's fallback catches it, and not in the scene's construction. `migrate` is the application's own
 *  migration: it rewrites a copy of each node's data on the way in, so `json` is left as it is, and defaults to none.
 *  The engine's migrations, of the snapshot's version and of its encoding, have run before it. A scene composed other
 *  than rigidly passes its own `opts.composition`, since the pages are made in
 *  a scene built on it. */
export function nodeSpecsFromSnapshot<TData, TLayer extends string, TPose>(
  json: SavedScene<TData, TLayer, TPose>,
  registry: SceneRegistry<TPose, TData, TLayer> = {},
  migrate: (data: TData) => TData = (data) => data,
  opts: SnapshotLoadOptions<TData, TLayer, TPose> = {},
): AddNodeSpec<TData, TLayer, TPose>[] {
  const { descriptor: _descriptor, pages: _pages, systemLayers, ...read } = opts;
  const specs = specsFromSerialized(adoptSnapshotPages(json, registry, opts), registry, { unknownKeys: 'skip', ...read })
    .map((spec) => ({ ...spec, data: migrate(copyPlain(spec.data)) }));
  if (systemLayers) {
    createScene({
      systemLayers, registry, initial: specs, ...(read.composition ? { composition: read.composition } : {}),
    } as UseSceneOptions<TData, TLayer, TPose>);
  }
  return specs;
}

/** `v` with every array and plain object in it copied, own `__proto__` keys included, so a migration that works in
 *  place leaves the snapshot it was read from as it was. Anything else is shared. */
function copyPlain<T>(v: T): T {
  if (Array.isArray(v)) return v.map(copyPlain) as T;
  if (v === null || typeof v !== 'object') return v;
  const proto: unknown = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) return v;
  const out = Object.create(proto) as Record<string, unknown>;
  for (const k of Object.keys(v)) {
    Object.defineProperty(out, k, { value: copyPlain((v as Record<string, unknown>)[k]), enumerable: true, writable: true, configurable: true });
  }
  return out as T;
}
