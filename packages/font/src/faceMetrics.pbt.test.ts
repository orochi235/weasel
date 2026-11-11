import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { faceMetricsFromTables, parseFaceMetrics, verticalMetricsFromTables, type FaceMetricTables, type FaceMetrics } from './faceMetrics';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 400;
const int16 = fc.oneof(fc.integer({ min: -32768, max: 32767 }), fc.constantFrom(0, 1, -1));
const uint16 = fc.oneof(fc.integer({ min: 0, max: 65535 }), fc.constant(0));
const opt = <T>(a: fc.Arbitrary<T>) => fc.option(a, { nil: undefined, freq: 4 });

/** Table fields as a font's tables hold them: 16-bit integers, any of them missing. */
const tables: fc.Arbitrary<FaceMetricTables> = fc.record({
  unitsPerEm: fc.oneof(fc.integer({ min: 16, max: 16384 }), fc.constantFrom(1000, 2048)),
  hhea: opt(fc.record({ ascender: opt(int16), descender: opt(int16) })),
  post: opt(fc.record({ underlinePosition: opt(int16), underlineThickness: opt(int16) })),
  os2: opt(fc.record({
    fsSelection: opt(uint16), sTypoAscender: opt(int16), sTypoDescender: opt(int16),
    usWinAscent: opt(uint16), usWinDescent: opt(uint16), yStrikeoutPosition: opt(int16), yStrikeoutSize: opt(int16),
    ySuperscriptYSize: opt(int16), ySuperscriptYOffset: opt(int16), ySubscriptYSize: opt(int16), ySubscriptYOffset: opt(int16),
    sxHeight: opt(int16), sCapHeight: opt(int16),
  })),
});

/** Every number in `t` times `k`, flags aside. */
function scaled(t: FaceMetricTables, k: number): FaceMetricTables {
  const times = <T extends object>(o: T | undefined): T | undefined => o && Object.fromEntries(
    Object.entries(o).map(([key, v]) => [key, typeof v === 'number' && key !== 'fsSelection' ? v * k : v])) as T;
  return { unitsPerEm: t.unitsPerEm * k, hhea: times(t.hhea), post: times(t.post), os2: times(t.os2) };
}

function near(a: FaceMetrics | undefined, b: FaceMetrics | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  const flat = (m: FaceMetrics): [string, number][] => Object.entries(m).flatMap(([k, v]) =>
    typeof v === 'number' ? [[k, v] as [string, number]] : Object.entries(v as object).map(([j, w]) => [`${k}.${j}`, w as number] as [string, number]));
  const fa = flat(a), fb = new Map(flat(b));
  return fa.length === fb.size && fa.every(([k, v]) => fb.has(k) && Math.abs(v - fb.get(k)!) <= 1e-12);
}

describe('faceMetricsFromTables, property', () => {
  it('states only finite numbers, positive weights and sizes, and a line box with height, which an atlas reads back as stated', () => {
    const t = tally();
    fc.assert(fc.property(tables, (tb) => {
      const m = faceMetricsFromTables(tb);
      if (!m) { t.count('none'); return; }
      t.count('some');
      if (m.ascent !== undefined) { t.count('vertical'); expect(m.ascent + m.descent!).toBeGreaterThan(0); }
      for (const r of [m.underline, m.strikethrough]) if (r) expect(r.thickness).toBeGreaterThan(0);
      for (const s of [m.superscript, m.subscript]) if (s) expect(s.size).toBeGreaterThan(0);
      const stored = JSON.parse(JSON.stringify(m)) as FaceMetrics;
      expect(parseFaceMetrics(stored)).toEqual(stored);
    }), runs(RUNS));
    t.atLeast('vertical', 50);
    t.atLeast('none', 5);
  }, timeoutFor(RUNS, 1));

  it('says the same in ems when every table field and the em scale together', () => {
    fc.assert(fc.property(tables, fc.integer({ min: 2, max: 8 }), (tb, k) => {
      expect(near(faceMetricsFromTables(scaled(tb, k)), faceMetricsFromTables(tb))).toBe(true);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));

  it('sets a face by its typo metrics when it asks to and they hold, else hhea, else typo, else win', () => {
    const t = tally();
    fc.assert(fc.property(tables, (tb) => {
      const v = verticalMetricsFromTables(tb);
      const o = tb.os2, h = tb.hhea, u = tb.unitsPerEm;
      const typo = o?.sTypoAscender !== undefined && o.sTypoDescender !== undefined && o.sTypoAscender - o.sTypoDescender > 0
        ? { ascent: o.sTypoAscender / u, descent: -o.sTypoDescender / u } : undefined;
      const hhea = h?.ascender !== undefined && h.descender !== undefined && h.ascender - h.descender > 0
        ? { ascent: h.ascender / u, descent: -h.descender / u } : undefined;
      const win = o?.usWinAscent !== undefined && o.usWinDescent !== undefined && o.usWinAscent + o.usWinDescent > 0
        ? { ascent: o.usWinAscent / u, descent: o.usWinDescent / u } : undefined;
      const useTypo = ((o?.fsSelection ?? 0) & 0x80) !== 0;
      const want = (useTypo ? typo : undefined) ?? hhea ?? typo ?? win;
      expect(v).toEqual(want);
      t.count(want === undefined ? 'none' : want === hhea ? 'hhea' : want === typo ? 'typo' : 'win');
    }), runs(RUNS));
    for (const k of ['none', 'hhea', 'typo', 'win']) t.atLeast(k, 10);
  }, timeoutFor(RUNS, 1));
});

const junk = fc.oneof(fc.double(), fc.integer(), fc.constantFrom(0, -1, NaN, Infinity), fc.string(), fc.constant(null));
const field = fc.oneof({ weight: 30, arbitrary: fc.double({ min: 0.01, max: 2, noNaN: true }) }, { weight: 1, arbitrary: junk });
const entry = (a: string, b: string) => fc.oneof(
  { weight: 12, arbitrary: fc.record({ [a]: field, [b]: field }) },
  { weight: 1, arbitrary: fc.oneof(fc.record({ [a]: field, [b]: field }, { requiredKeys: [] }), junk) },
);
const raw = fc.oneof(
  { weight: 6, arbitrary: fc.record({
    ascent: field, descent: field, underline: entry('offset', 'thickness'), strikethrough: entry('offset', 'thickness'),
    superscript: entry('size', 'shift'), subscript: entry('size', 'shift'), xHeight: field, capHeight: field,
  }, { requiredKeys: [] }) },
  { weight: 1, arbitrary: fc.anything() },
);

describe('parseFaceMetrics, fuzzed', () => {
  it('refuses a malformed block by name, or reads one it reads back the same', () => {
    const t = tally();
    fc.assert(fc.property(raw, (r) => {
      let m: FaceMetrics | undefined;
      try {
        m = parseFaceMetrics(r);
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toMatch(/^parseBmFont: /);
        t.count('refused');
        return;
      }
      t.count(m ? 'read' : 'empty');
      if (!m) return;
      const stored = JSON.parse(JSON.stringify(m)) as FaceMetrics;
      expect(parseFaceMetrics(stored)).toEqual(stored);
      for (const v of Object.values(m)) {
        for (const n of typeof v === 'number' ? [v] : Object.values(v as object)) expect(Number.isFinite(n)).toBe(true);
      }
    }), runs(RUNS));
    t.atLeast('refused', 50);
    t.atLeast('read', 20);
    t.atLeast('empty', 5);
  }, timeoutFor(RUNS, 1));
});
