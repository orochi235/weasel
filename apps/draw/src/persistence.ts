// Shared serialization helpers for WeaselDraw's localStorage persistence.
//
// PolygonPath stores `commands` as Uint8Array and `coords` as Float32Array.
// JSON.stringify renders typed arrays as `{"0":1,"1":2,...}` plain objects —
// the painter then sees a non-iterable shape and silently fails to draw. We
// tag typed arrays on save and reconstruct them on load (with tolerance for
// older saves that wrote the broken numeric-key object shape).
//
// These helpers are shared by both the scene snapshot and the undo-history
// snapshot (whose serialized op payloads also carry path poses), so they live
// outside App's component module to stay independently testable.

import type { AddNodeSpec, SerializedScene } from '@weasel-js/core';
import { asNodeId, solid } from '@weasel-js/core';

type TaggedTypedArray = { __ta: 'u8' | 'f32'; data: number[] };

/** `JSON.stringify` replacer: tag typed arrays so they survive the round-trip. */
export function serializeReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Uint8Array) return { __ta: 'u8', data: Array.from(value) } satisfies TaggedTypedArray;
  if (value instanceof Float32Array) return { __ta: 'f32', data: Array.from(value) } satisfies TaggedTypedArray;
  return value;
}

/** Walk a parsed snapshot and rebuild any tagged / numeric-key typed arrays in
 *  place. Returns the same node for call-site convenience. */
export function reviveTypedArrays<T>(node: T): T {
  if (node == null || typeof node !== 'object') return node;
  const obj = node as Record<string, unknown>;
  const tag = obj.__ta;
  if (tag === 'u8' && Array.isArray(obj.data)) return Uint8Array.from(obj.data as number[]) as unknown as T;
  if (tag === 'f32' && Array.isArray(obj.data)) return Float32Array.from(obj.data as number[]) as unknown as T;
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
      reviveTypedArrays(obj[k]);
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
 *  old leaf-only path dropped both. `toJSON()` emits nodes in layer-major
 *  DFS-preorder (parents before children), so a sequential `add` finds each
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
