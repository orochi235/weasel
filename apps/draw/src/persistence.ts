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
