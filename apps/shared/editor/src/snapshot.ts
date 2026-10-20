// Typed-array and snapshot helpers shared by every editor app's localStorage persistence.
//
// A path keeps its commands and coords in typed arrays, which `JSON.stringify`
// writes as `{"0":1,"1":2,...}`. Saves tag them with `@weasel-js/geom`'s
// encoding; loads read the tags back, and also the untagged shapes older saves
// wrote, which is why the walk here is our own.

import type { AddNodeSpec, SceneRegistry, SerializedScene } from '@weasel-js/core';
import { asNodeId } from '@weasel-js/core';
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
  json: SerializedScene<TData, TLayer, TPose>,
): Readonly<Record<string, unknown>> | undefined {
  const { doc } = json;
  return doc !== null && typeof doc === 'object' && !Array.isArray(doc) ? doc : undefined;
}

/** Rebuild the full node list from a persisted scene snapshot, shaped for
 *  `useScene`'s `initial` option. Preserves every node's `kind`, `layer`, and
 *  `parent`, so containers (Cmd+G groups) and nesting survive a reload — the
 *  old leaf-only path dropped both. `toJSON()` emits nodes in tree preorder
 *  (parents before children), so a sequential `add` finds each
 *  node's parent already present.
 *
 *  A node's `dependsOn`, its derivations, and a container's layout come back
 *  too, each looked up by its key in `registry`: a key `registry` lacks leaves
 *  the node as authored. So do the pickable, hidden, and locked flags.
 *  Container clip-paths (`clipFromPoseKey`) are not restored.
 *  `revive` rewrites each node's data on the way in; the default revives typed arrays only. */
export function nodeSpecsFromSnapshot<TData, TLayer extends string, TPose>(
  json: SerializedScene<TData, TLayer, TPose>,
  registry: SceneRegistry<TPose, TData, TLayer> = {},
  revive: <T>(node: T) => T = reviveTypedArrays,
): AddNodeSpec<TData, TLayer, TPose>[] {
  return json.nodes.map((n) => {
    const derivePath = n.derivePathKey === undefined ? undefined : registry.derivePath?.[n.derivePathKey];
    const derivePose = n.derivePoseKey === undefined ? undefined : registry.derivePose?.[n.derivePoseKey];
    const layout = n.layoutKey === undefined ? undefined : registry.layout?.[n.layoutKey];
    return {
      kind: n.kind,
      layer: n.layer,
      pose: n.pose,
      data: revive(n.data),
      id: asNodeId(n.id),
      ...(n.parent != null ? { parent: asNodeId(n.parent) } : {}),
      ...(n.dependsOn !== undefined ? { dependsOn: n.dependsOn === 'children' ? 'children' : n.dependsOn.map(asNodeId) } : {}),
      ...(derivePath ? { derivePath } : {}),
      ...(derivePose ? { derivePose } : {}),
      ...(layout ? { layout } : {}),
      ...(n.pickable === false ? { pickable: false } : {}),
      ...(n.hidden === true ? { hidden: true } : {}),
      ...(n.locked === true ? { locked: true } : {}),
    };
  });
}
