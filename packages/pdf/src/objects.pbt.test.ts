/**
 * Property tests of PDF object syntax: `num` reads back within its rounding and never in a form PDF
 * forbids, `latin1` round-trips, every value `PdfObjects` writes reads back as itself, and the object
 * table, written through any sequence of allocations, writes, rollbacks, and deferred streams, puts
 * each object where the xref says.
 */
import { deflateSync } from 'node:zlib';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ContentStream } from './content';
import { latin1, latin1Bytes } from './latin1';
import { NonFiniteNumber, num } from './num';
import { bytes, name, PdfBytes, type PdfDict, PdfName, PdfObjects, PdfRef, PdfText, type PdfValue, text, writeDict } from './objects';
import { anyFinite, runs, tally, timeoutFor } from './pbt.fixture';
import { isDict, Lexer, Name, NUMBER, readPdf, Ref, Str, textOf, type Value } from './pdfReader.fixture';

const RUNS = 300;

describe('num', () => {
  it('writes a finite number in PDF real syntax, within half its last place, and the same again when read back', () => {
    const seen = tally();
    fc.assert(
      fc.property(anyFinite, (n) => {
        const s = num(n);
        expect(s).toMatch(NUMBER);
        expect(s).not.toMatch(/^-0(\.0*)?$/);
        expect(s).not.toMatch(/\.\d*0$/);
        const back = Number(s);
        expect(Math.abs(back - n)).toBeLessThanOrEqual(5e-5 + Math.abs(n) * Number.EPSILON);
        expect(num(back)).toBe(s);
        seen.count(Math.abs(n) >= 1e21 ? 'huge' : Math.abs(n) < 1e-4 ? 'tiny' : 'plain');
      }),
      runs(RUNS),
    );
    for (const what of ['huge', 'tiny', 'plain']) seen.atLeast(what, 10);
  }, timeoutFor(RUNS, 2));

  it('refuses a non-finite number with NonFiniteNumber', () => {
    for (const n of [NaN, Infinity, -Infinity]) expect(() => num(n)).toThrow(NonFiniteNumber);
  });
});

describe('latin1', () => {
  it('round-trips any bytes, and any string of one-byte chars', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 64 }), fc.string({ unit: fc.integer({ min: 0, max: 255 }).map((c) => String.fromCharCode(c)) }), (b, s) => {
        expect(latin1Bytes(latin1(b))).toEqual(b);
        expect(latin1(latin1Bytes(s))).toBe(s);
      }),
      runs(RUNS),
    );
  }, timeoutFor(RUNS, 2));
});

/** A name's text: any well-formed string but NUL, which PDF names cannot hold even escaped. */
const nameText = fc.string({ unit: 'grapheme', maxLength: 8 }).filter((s) => !s.includes('\0'));

function pdfValue(): fc.Arbitrary<PdfValue> {
  const { v } = fc.letrec<{ v: PdfValue }>((tie) => ({
    v: fc.oneof(
      { depthSize: 'small', withCrossShrink: true },
      anyFinite,
      fc.boolean(),
      fc.constant(null),
      nameText.map(name),
      fc.integer({ min: 1, max: 99 }).map((id) => new PdfRef(id)),
      fc.string({ unit: 'binary', maxLength: 10 }).map(text),
      fc.string({ maxLength: 10 }).map(text),
      fc.uint8Array({ maxLength: 8 }).map(bytes),
      fc.array(tie('v'), { maxLength: 4 }),
      fc.dictionary(fc.oneof(nameText, fc.constantFrom('__proto__', 'constructor', 'toString')), tie('v'), { maxKeys: 4 }),
    ),
  }));
  return v;
}

/** Whether `got`, as read, is what `want` wrote. */
function same(got: Value, want: PdfValue): void {
  if (typeof want === 'number') {
    expect(typeof got).toBe('number');
    expect(Math.abs((got as number) - want)).toBeLessThanOrEqual(5e-5 + Math.abs(want) * Number.EPSILON);
  } else if (want === null || typeof want === 'boolean') expect(got).toBe(want);
  else if (want instanceof PdfName) expect((got as Name).value).toBe(want.value);
  else if (want instanceof PdfRef) expect(got).toEqual(new Ref(want.id, 0));
  else if (want instanceof PdfText) expect(textOf(got as Str)).toBe(want.value);
  else if (want instanceof PdfBytes) expect([...(got as Str).bytes]).toEqual([...want.value]);
  else if (Array.isArray(want)) {
    expect(Array.isArray(got)).toBe(true);
    expect((got as Value[]).length).toBe(want.length);
    want.forEach((w, i) => same((got as Value[])[i]!, w));
  } else {
    expect(isDict(got)).toBe(true);
    const d = want as PdfDict;
    const keys = Object.keys(d).filter((k) => d[k] !== undefined);
    expect(Object.keys(got as object).sort()).toEqual(keys.sort());
    for (const k of keys) same((got as Record<string, Value>)[k]!, d[k]!);
  }
}

describe('PdfObjects values', () => {
  it('reads back every value it writes', () => {
    fc.assert(
      fc.property(fc.dictionary(nameText, pdfValue(), { maxKeys: 5 }), (d) => {
        same(new Lexer(latin1Bytes(writeDict(d))).value(), d);
      }),
      runs(RUNS),
    );
  }, timeoutFor(RUNS, 5));
});

type Step =
  | { kind: 'alloc' }
  | { kind: 'set'; pick: number; value: PdfValue }
  | { kind: 'stream'; pick: number; data: Uint8Array }
  | { kind: 'deferred'; pick: number; data: Uint8Array }
  | { kind: 'mark' }
  | { kind: 'null' };

const step: fc.Arbitrary<Step> = fc.oneof(
  { weight: 3, arbitrary: fc.constant({ kind: 'alloc' as const }) },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('set' as const), pick: fc.nat(), value: pdfValue() }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('stream' as const), pick: fc.nat(), data: fc.uint8Array({ maxLength: 40 }) }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('deferred' as const), pick: fc.nat(), data: fc.uint8Array({ maxLength: 40 }) }) },
  { weight: 1, arbitrary: fc.constant({ kind: 'mark' as const }) },
  { weight: 1, arbitrary: fc.constant({ kind: 'null' as const }) },
);

type Body = { value: PdfValue } | { stream: Uint8Array; deferred: boolean };

describe('PdfObjects table', () => {
  it('puts every object where the xref says, as last written, through any sequence of writes and rollbacks', async () => {
    const seen = tally();
    await fc.assert(
      fc.asyncProperty(fc.array(step, { maxLength: 30 }), fc.boolean(), async (steps, compress) => {
        const o = new PdfObjects();
        const root = o.alloc();
        const model: (Body | undefined)[] = [{ value: null }];
        o.set(root, null);
        let mark = o.mark();
        for (const s of steps) {
          if (s.kind === 'alloc') {
            expect(o.alloc().id).toBe(model.length + 1);
            model.push(undefined);
          } else if (s.kind === 'mark') mark = o.mark();
          else if (s.kind === 'null') {
            o.nullUnset(mark);
            for (let i = mark; i < model.length; i++) model[i] ??= { value: null };
            seen.count('null');
          } else {
            const at = s.pick % model.length;
            const ref = new PdfRef(at + 1);
            // A deferred stream is written once, at `settle`; nothing else writes it again first.
            const body = model[at];
            if (body && 'deferred' in body && body.deferred) continue;
            if (s.kind === 'set') {
              o.set(ref, s.value);
              model[at] = { value: s.value };
            } else if (s.kind === 'stream') {
              o.stream(ref, { K: 1 }, s.data);
              model[at] = { stream: s.data, deferred: false };
            } else {
              o.streamDeflated(ref, { K: 1 }, s.data);
              model[at] = { stream: s.data, deferred: true };
              seen.count('deferred');
            }
          }
        }
        await o.settle(compress, async (d) => new Uint8Array(deflateSync(d)));
        if (model.some((b) => b === undefined)) {
          expect(() => o.serialize(root)).toThrow(/allocated but never set/);
          seen.count('unset');
          return;
        }
        const pdf = readPdf(o.serialize(root));
        expect(pdf.objects.size).toBe(model.length);
        model.forEach((b, i) => {
          const got = pdf.objects.get(i + 1)!;
          if (b && 'value' in b) {
            expect(got.stream).toBeUndefined();
            same(got.value, b.value);
          } else {
            expect([...got.stream!.data]).toEqual([...b!.stream]);
            expect((got.value as Record<string, Value>).Length).toBe(got.stream!.raw.length);
            if (b!.deferred && compress) expect(((got.value as Record<string, Value>).Filter as Name).value).toBe('FlateDecode');
          }
        });
        seen.count('serialized');
      }),
      runs(RUNS),
    );
    for (const what of ['null', 'deferred', 'unset', 'serialized']) seen.atLeast(what, 10);
  }, timeoutFor(RUNS, 10));
});

describe('ContentStream', () => {
  it('after any rollback, writes what a fresh stream given only the operators kept writes', () => {
    const op = fc.oneof(
      fc.record({ op: fc.constantFrom('q', 'Q', 'cm', 're', 'f'), args: fc.array(fc.oneof(anyFinite, fc.constant('/GS1')), { maxLength: 6 }) }),
      fc.record({ op: fc.constant('cm'), args: fc.array(anyFinite, { minLength: 6, maxLength: 6 }) as fc.Arbitrary<(number | string)[]> }),
    );
    const act = fc.oneof(op.map((o) => ({ kind: 'op' as const, ...o })), fc.constant({ kind: 'mark' as const }), fc.nat().map((n) => ({ kind: 'rollback' as const, n })));
    const seen = tally();
    fc.assert(
      fc.property(fc.array(act, { maxLength: 20 }), (acts) => {
        const out = new ContentStream();
        const kept: { op: string; args: (number | string)[] }[] = [];
        const marks: number[] = [0];
        for (const a of acts) {
          if (a.kind === 'op') {
            out.op(a.op, ...a.args);
            kept.push(a);
          } else if (a.kind === 'mark') marks.push(out.mark());
          else {
            const at = marks[a.n % marks.length]!;
            if (at > kept.length) continue;
            out.rollback(at);
            kept.length = at;
            seen.count('rollback');
          }
          const fresh = new ContentStream();
          for (const k of kept) fresh.op(k.op, ...k.args);
          expect(latin1(out.bytes())).toBe(latin1(fresh.bytes()));
        }
        if (kept.some((k) => k.op === 'cm' && k.args.length === 6 && k.args.every((x) => typeof x === 'number'))) seen.count('scaled');
      }),
      runs(RUNS),
    );
    seen.atLeast('rollback', 30);
    seen.atLeast('scaled', 10);
  }, timeoutFor(RUNS, 2));
});
