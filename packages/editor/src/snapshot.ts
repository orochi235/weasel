// Typed-array and snapshot helpers shared by every editor app's localStorage persistence.
//
// A path keeps its commands and coords in typed arrays, which `JSON.stringify`
// writes as `{"0":1,"1":2,...}`. Saves tag them with `@weasel-js/geom`'s
// encoding; loads read the tags back, and also the untagged shapes older saves
// wrote, which is why the walk here is our own.

import type {
  AddNodeSpec, SceneRegistry, SavedScene, SpecsFromSerializedOptions,
} from '@weasel-js/core';
import { PAGES_DOC_KEY, adoptLegacyPages, asNodeId, sceneFromJSON, specsFromSerialized } from '@weasel-js/core';
import { typedArrayReplacer, untagTypedArray } from '@weasel-js/geom';

/** `JSON.stringify` replacer: tag typed arrays so they survive the round-trip. */
export const serializeReplacer = typedArrayReplacer;

/** Walk a parsed snapshot and rebuild any tagged / numeric-key typed arrays in
 *  place. Returns the same node for call-site convenience. */
export function reviveTypedArrays<T>(node: T): T {
  if (node == null || typeof node !== 'object') return node;
  const tagged = untagTypedArray(node);
  if (tagged) return tagged as unknown as T;
  const obj = node as Record<string, unknown>;
  for (const k of Object.keys(obj)) {
    if (k === 'commands' || k === 'coords') {
      const v = obj[k];
      if (v instanceof Uint8Array || v instanceof Float32Array) continue;
      if (Array.isArray(v)) {
        obj[k] = k === 'commands' ? Uint8Array.from(v as number[]) : Float32Array.from(v as number[]);
        continue;
      }
      if (v && typeof v === 'object') {
        // Recover from older saves that lost the typed-array shape.
        const src = v as Record<string, unknown>;
        if (src.__ta) { obj[k] = reviveTypedArrays(v); continue; }
        const len = Object.keys(src).filter((kk) => /^\d+$/.test(kk)).length;
        const arr = new Array<number>(len);
        for (let i = 0; i < len; i++) arr[i] = Number(src[String(i)] ?? 0);
        obj[k] = k === 'commands' ? Uint8Array.from(arr) : Float32Array.from(arr);
        continue;
      }
    } else {
      obj[k] = reviveTypedArrays(obj[k]);
    }
  }
  return node;
}

/**
 * `json` with its pages as page nodes: a snapshot saved while a scene's pages were its `core:pages`
 * value is built into a scene, converted there by core's `adoptLegacyPages`, and written out again.
 * Any other snapshot comes back as it is. `registry` and `opts` are what the load reads it with.
 */
export function adoptSnapshotPages<TData, TLayer extends string, TPose>(
  json: SavedScene<TData, TLayer, TPose>,
  registry: SceneRegistry<TPose, TData, TLayer> = {},
  opts: SpecsFromSerializedOptions<TData, TLayer, TPose> = {},
): SavedScene<TData, TLayer, TPose> {
  if (json.doc?.[PAGES_DOC_KEY] === undefined) return json;
  const taken = new Set<string>(json.nodes.map((n) => n.id));
  let n = 0;
  // The run is the one node adoption mints; a fixed id loads the same snapshot the same way every time.
  const generateId = () => {
    let id = 'page-run';
    while (taken.has(id)) id = `page-run-${++n}`;
    taken.add(id);
    return asNodeId(id);
  };
  const scene = sceneFromJSON(json, { registry, unknownKeys: 'skip', generateId, ...opts });
  adoptLegacyPages(scene);
  return scene.toJSON();
}

/** The document values a persisted snapshot carries, shaped for `useScene`'s `doc` option, or
 *  `undefined` for a snapshot written before it had any. A `core:pages` value is not among them:
 *  `nodeSpecsFromSnapshot` loads those pages as nodes (`adoptSnapshotPages`). */
export function docFromSnapshot<TData, TLayer extends string, TPose>(
  json: SavedScene<TData, TLayer, TPose>,
): Readonly<Record<string, unknown>> | undefined {
  const { doc } = adoptSnapshotPages(json);
  return doc !== null && typeof doc === 'object' && !Array.isArray(doc) ? doc : undefined;
}

/** Rebuild the full node list from a persisted scene snapshot, shaped for
 *  `useScene`'s `initial` option: core's `specsFromSerialized`, so every field
 *  a save writes comes back. A key `registry` lacks leaves the node without
 *  that function rather than failing the load, unless `opts.unknownKeys` says
 *  `'throw'`; `opts.onSkip` hears each. Pages saved as a `core:pages` value
 *  come back as page nodes. `revive` rewrites each node's data on
 *  the way in; the default revives typed arrays only. */
export function nodeSpecsFromSnapshot<TData, TLayer extends string, TPose>(
  json: SavedScene<TData, TLayer, TPose>,
  registry: SceneRegistry<TPose, TData, TLayer> = {},
  revive: <T>(node: T) => T = reviveTypedArrays,
  opts: SpecsFromSerializedOptions<TData, TLayer, TPose> = {},
): AddNodeSpec<TData, TLayer, TPose>[] {
  return specsFromSerialized(adoptSnapshotPages(json, registry, opts), registry, { unknownKeys: 'skip', ...opts })
    .map((spec) => ({ ...spec, data: revive(spec.data) }));
}
