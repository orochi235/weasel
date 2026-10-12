// Shared serialization helpers for WeaselDraw's localStorage persistence.
//
// A path keeps its commands and coords in typed arrays, which `JSON.stringify`
// writes as `{"0":1,"1":2,...}`. Saves tag them with `@weasel-js/geom`'s
// encoding; loads read the tags back, and also the untagged shapes older saves
// wrote, which is why the walk here is draw's own.

import type { AddNodeSpec, SerializedScene } from '@weasel-js/core';
import { asNodeId, solid } from '@weasel-js/core';
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

/** The `FillStyle` discriminant values. A paint in the current shape carries
 *  one of these under `fill`, so "a string under `fill`" is not on its own a
 *  legacy color — it is the tag. */
const FILL_KINDS = new Set(['solid', 'pattern', 'linear-gradient', 'radial-gradient', 'conic-gradient']);

/** A string paint that means "no paint at all" rather than a color. */
const NO_PAINT = new Set(['none', 'transparent']);

function paintFromLegacy(color: string): { color: string; opacity?: number } | null {
  return NO_PAINT.has(color.toLowerCase()) ? null : solid(color) as { color: string; opacity?: number };
}

/**
 * Rewrite the pre-2026-08-26 string paint forms — `fill: '#abc'`,
 * `stroke: '#abc'` with a sibling `strokeWidth` — into the `FillStyle` and
 * `Stroke` objects every reader now expects. Walks in place and returns the
 * same node, like `reviveTypedArrays`.
 *
 * Applied to node data and to the node data copied inside a history
 * snapshot's op payloads, so an undo after a reload cannot write a string
 * back into a migrated scene.
 */
export function migrateLegacyPaint<T>(node: T): T {
  if (node == null || typeof node !== 'object') return node;
  if (Array.isArray(node)) {
    for (const item of node) migrateLegacyPaint(item);
    return node;
  }
  const obj = node as Record<string, unknown>;

  if (typeof obj.fill === 'string' && !FILL_KINDS.has(obj.fill)) {
    obj.fill = paintFromLegacy(obj.fill);
  }
  if (typeof obj.stroke === 'string') {
    const paint = paintFromLegacy(obj.stroke);
    const width = typeof obj.strokeWidth === 'number' ? obj.strokeWidth : 1;
    obj.stroke = paint === null ? null : { paint, width };
  }
  if ('strokeWidth' in obj) delete obj.strokeWidth;

  for (const k of Object.keys(obj)) migrateLegacyPaint(obj[k]);
  return node;
}

/**
 * The one way to read anything that came out of localStorage: revive the
 * typed arrays, then migrate the legacy string paints. Both the scene and the
 * two history snapshots go through it, so neither pass can be forgotten at a
 * load site.
 */
export function reviveSnapshot<T>(node: T): T {
  return migrateLegacyPaint(reviveTypedArrays(node));
}

/** `JSON.parse`-style reviver for clipboard payloads (the shape
 *  `IngestCtx.clipboard.reviver` expects): one `reviveTypedArrays` pass over
 *  the fully-parsed tree, applied at the reviver's final root call
 *  (`key === ''`). NOT interchangeable with `reviveTypedArrays` itself —
 *  a JSON reviver is `(key, value) => value`, and wiring the one-arg walker
 *  in directly makes it receive each KEY (a string) and return it, collapsing
 *  the whole parse to `''`. */
export function clipboardJsonReviver(key: string, value: unknown): unknown {
  return key === '' ? reviveSnapshot(value) : value;
}

/** Rebuild the full node list from a persisted scene snapshot, shaped for
 *  `useScene`'s `initial` option. Preserves every node's `kind`, `layer`, and
 *  `parent`, so containers (Cmd+G groups) and nesting survive a reload — the
 *  old leaf-only path dropped both. `toJSON()` emits nodes in tree preorder
 *  (parents before children), so a sequential `add` finds each
 *  node's parent already present.
 *
 *  Note: container clip-paths (`clipFromPoseKey`) are not restored — WeaselDraw
 *  groups carry no clip today. Wire a `SceneRegistry` here if that changes. */
export function nodeSpecsFromSnapshot<TData, TLayer extends string, TPose>(
  json: SerializedScene<TData, TLayer, TPose>,
): AddNodeSpec<TData, TLayer, TPose>[] {
  return json.nodes.map((n) => ({
    kind: n.kind,
    layer: n.layer,
    pose: n.pose,
    data: reviveSnapshot(n.data),
    id: asNodeId(n.id),
    ...(n.parent != null ? { parent: asNodeId(n.parent) } : {}),
  }));
}
