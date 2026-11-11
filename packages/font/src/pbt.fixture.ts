/**
 * fast-check arbitraries shared by font's property tests. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** `{ numRuns: n }`, or the count in `WEASEL_PBT_RUNS` when set: a deep run on the fleet raises every property's at once. */
export function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}

/** A test timeout for a property costing about `msPerRun` a run, at the count {@link runs} settles on. */
export function timeoutFor(n: number, msPerRun: number): number {
  return Math.max(5_000, runs(n).numRuns * msPerRun);
}

/** Counts of what a property's runs exercised, so one whose inputs all miss the point fails. */
export function tally(): { count(what: string): void; atLeast(what: string, n: number): void } {
  const seen = new Map<string, number>();
  return {
    count(what) { seen.set(what, (seen.get(what) ?? 0) + 1); },
    atLeast(what, n) {
      if ((seen.get(what) ?? 0) < n) throw new Error(`${what} ran ${seen.get(what) ?? 0} times, wanted ${n}: ${JSON.stringify([...seen])}`);
    },
  };
}

const INTER_TTF = resolve(import.meta.dirname, '../../../assets/fonts/inter/inter.ttf');

/** A fresh copy of the repo's Inter subset: a TrueType font with GPOS kerning behind an extension lookup. */
export function interBytes(): ArrayBuffer {
  const buf = readFileSync(INTER_TTF);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/** Each table record of a single font: its tag, offset, and length. */
export function tablesOf(bytes: ArrayBuffer): { tag: string; offset: number; length: number }[] {
  const v = new DataView(bytes);
  const out = [];
  for (let i = 0; i < v.getUint16(4); i++) {
    const at = 12 + i * 16;
    const tag = String.fromCharCode(v.getUint8(at), v.getUint8(at + 1), v.getUint8(at + 2), v.getUint8(at + 3));
    out.push({ tag, offset: v.getUint32(at + 8), length: v.getUint32(at + 12) });
  }
  return out;
}

/** One edit to a font file's bytes. Offsets are fractions of the file, or of the region it is drawn for. */
export type Mutation =
  | { kind: 'flip'; at: number; byte: number }
  | { kind: 'word'; at: number; value: number }
  | { kind: 'truncate'; at: number }
  | { kind: 'zero'; at: number; length: number };

/** Edits aimed at `[from, to)` of the file: byte and word overwrites, zeroed runs, and truncation. */
export function mutations(maxLength = 6): fc.Arbitrary<Mutation[]> {
  const at = fc.noBias(fc.integer({ min: 0, max: 999_999 })).map((n) => n / 1_000_000);
  const mutation: fc.Arbitrary<Mutation> = fc.oneof(
    { weight: 4, arbitrary: fc.record({ kind: fc.constant('flip' as const), at, byte: fc.integer({ min: 0, max: 255 }) }) },
    {
      weight: 4,
      arbitrary: fc.record({
        kind: fc.constant('word' as const), at,
        value: fc.oneof(fc.constantFrom(0, 1, 0xffff, 0x7fff, 0x8000, 0xffffffff, 0x10000), fc.nat({ max: 0xffffffff })),
      }),
    },
    { weight: 1, arbitrary: fc.record({ kind: fc.constant('truncate' as const), at }) },
    { weight: 1, arbitrary: fc.record({ kind: fc.constant('zero' as const), at, length: fc.integer({ min: 1, max: 64 }) }) },
  );
  return fc.array(mutation, { minLength: 1, maxLength });
}

/** `bytes` with `edits` applied to the region `[from, to)`; a word edit writes 2 or 4 bytes as its value needs. */
export function mutate(bytes: ArrayBuffer, edits: readonly Mutation[], from = 0, to = bytes.byteLength): ArrayBuffer {
  let out = bytes.slice(0);
  for (const e of edits) {
    const at = from + Math.floor(e.at * (to - from));
    if (at >= out.byteLength) continue;
    const view = new DataView(out);
    if (e.kind === 'flip') view.setUint8(at, e.byte);
    else if (e.kind === 'word') {
      if (e.value > 0xffff && at + 4 <= out.byteLength) view.setUint32(at, e.value);
      else if (at + 2 <= out.byteLength) view.setUint16(at, e.value & 0xffff);
    } else if (e.kind === 'zero') new Uint8Array(out, at, Math.min(e.length, out.byteLength - at)).fill(0);
    else out = out.slice(0, at);
  }
  return out;
}
