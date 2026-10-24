// Typed-array and snapshot helpers shared by every editor app's localStorage persistence.
//
// A path keeps its commands and coords in typed arrays, which `JSON.stringify`
// writes as `{"0":1,"1":2,...}`. Saves tag them with `@weasel-js/geom`'s
// encoding; loads read the tags back, and also the untagged shapes older saves
// wrote, which is why the walk here is our own.

import type { AddNodeSpec, SceneRegistry, SerializedScene, SerializedSceneV1, V1Classifier } from '@weasel-js/core';
import { specsFromSerialized } from '@weasel-js/core';
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

/** The document values a persisted snapshot carries, shaped for `useScene`'s `doc` option, or
 *  `undefined` for a snapshot written before it had any. */
export function docFromSnapshot<TData, TLayer extends string, TPose>(
  json: SerializedScene<TData, TLayer, TPose> | SerializedSceneV1<TData, TLayer, TPose>,
): Readonly<Record<string, unknown>> | undefined {
  const { doc } = json;
  return doc !== null && typeof doc === 'object' && !Array.isArray(doc) ? doc : undefined;
}

/** Rebuild the full node list from a persisted scene snapshot, shaped for
 *  `useScene`'s `initial` option: core's `specsFromSerialized`, so every field
 *  a save writes comes back. A key `registry` lacks leaves the node without
 *  that function rather than failing the load. `revive` rewrites each node's
 *  data on the way in; the default revives typed arrays only. A version 1
 *  snapshot's containers are groups unless `classifyV1` says otherwise. */
export function nodeSpecsFromSnapshot<TData, TLayer extends string, TPose>(
  json: SerializedScene<TData, TLayer, TPose> | SerializedSceneV1<TData, TLayer, TPose>,
  registry: SceneRegistry<TPose, TData, TLayer> = {},
  revive: <T>(node: T) => T = reviveTypedArrays,
  opts: { classifyV1?: V1Classifier<TData, TLayer, TPose> } = {},
): AddNodeSpec<TData, TLayer, TPose>[] {
  return specsFromSerialized(json, registry, { ...opts, unknownKeys: 'skip' })
    .map((spec) => ({ ...spec, data: revive(spec.data) }));
}
