import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseColor } from './color';
import type { Paint, Stroke } from './paint';
import { paintKey, strokeHasInk, strokeKey } from './paintKey';
import { byte, runs, tally } from './pbt.fixture';

const RUNS = runs(300);

/** One color's spellings, so equal paints come up written apart. */
function spellings([r, g, b]: readonly number[]): string[] {
  const h = (v: number): string => v.toString(16).padStart(2, '0');
  return [`#${h(r!)}${h(g!)}${h(b!)}`, `#${h(r!)}${h(g!)}${h(b!)}ff`.toUpperCase(), `rgb(${r}, ${g}, ${b})`, `rgb(${r} ${g} ${b} / 1)`];
}
const triple = fc.tuple(fc.constantFrom(0, 128, 255), fc.constantFrom(0, 255), byte);
const spelled = triple.chain((c) => fc.constantFrom(...spellings(c)));
/** Few enough values that two draws often coincide. */
const small = fc.constantFrom(0, 0.5, 1);

const solid = fc.record({ color: spelled, opacity: fc.option(fc.constantFrom(0, 0.5, 1), { nil: undefined }), kind: fc.constantFrom(undefined, 'solid' as const) })
  .map((p) => p as Paint);
const gradient = fc.record({
  kind: fc.constant('linear-gradient' as const),
  from: fc.record({ x: small, y: small }),
  to: fc.record({ x: small, y: small }),
  stops: fc.array(fc.record({ offset: small, color: fc.constantFrom('#000', '#fff') }), { minLength: 1, maxLength: 2 }),
  opacity: fc.option(small, { nil: undefined }),
}).map((p) => p as Paint);
const paint = fc.oneof(solid, gradient);
/** Two paints, often one paint written two ways. */
const pair: fc.Arbitrary<[Paint, Paint]> = fc.oneof(
  fc.tuple(paint, paint),
  fc.tuple(triple, fc.constantFrom(undefined, 0.5)).chain(([c, opacity]) => fc.tuple(
    ...[0, 1].map(() => fc.constantFrom(...spellings(c)).map((color) => (opacity === undefined ? { color } : { color, opacity }) as Paint)),
  ) as fc.Arbitrary<[Paint, Paint]>),
  gradient.map((g) => [g, respelled(structuredClone(g))] as [Paint, Paint]),
);

/** `value` rebuilt with its keys in reverse order and an explicit `undefined` beside them. */
function respelled<T>(value: T): T {
  if (Array.isArray(value)) return value.map(respelled) as T;
  if (typeof value !== 'object' || value === null) return value;
  const out: Record<string, unknown> = { zz: undefined };
  for (const k of Object.keys(value).reverse()) out[k] = respelled((value as Record<string, unknown>)[k]);
  return out as T;
}

/** What two solids draw: the same color at the same alpha, or nothing at all. */
function drawsAs(p: Paint): string {
  const s = p as { color: string; opacity?: number };
  const [r, g, b, a] = parseColor(s.color);
  const alpha = a * (s.opacity ?? 1);
  return alpha === 0 ? 'clear' : `${r},${g},${b},${alpha}`;
}
/** Structural equality with undefined fields dropped. */
const plain = (v: unknown): string => JSON.stringify(v, (_k, x: unknown) => (x && typeof x === 'object' && !Array.isArray(x)
  ? Object.fromEntries(Object.entries(x).filter(([, y]) => y !== undefined).sort(([a], [b]) => (a < b ? -1 : 1)))
  : x));

describe('paintKey, property', () => {
  it('keys a paint and its copy, respelled, alike', () => {
    fc.assert(fc.property(paint, (p) => {
      expect(paintKey(respelled(p))).toBe(paintKey(p));
      expect(paintKey(p)).toBe(paintKey(p));
    }), RUNS);
  });

  it('keys two paints alike exactly when they draw the same', () => {
    const t = tally();
    fc.assert(fc.property(pair, ([a, b]) => {
      const same = paintKey(a) === paintKey(b);
      const aSolid = !('stops' in a), bSolid = !('stops' in b);
      if (aSolid && bSolid) {
        t.count(same ? 'solids alike' : 'solids apart');
        expect(same).toBe(drawsAs(a) === drawsAs(b));
      } else if (!aSolid && !bSolid) {
        t.count(same ? 'gradients alike' : 'gradients apart');
        expect(same).toBe(plain(a) === plain(b));
      } else {
        expect(same).toBe(false);
      }
    }), RUNS);
    for (const k of ['solids alike', 'solids apart', 'gradients alike', 'gradients apart']) t.atLeast(k, 1);
  });

  it('keeps a key off every other kind\'s, and none for no paint', () => {
    fc.assert(fc.property(paint, (p) => {
      expect(paintKey(p)).not.toBe('none');
      expect(paintKey(null)).toBe('none');
      expect(paintKey(undefined)).toBe('none');
    }), RUNS);
  });
});

describe('strokeKey, property', () => {
  const width = fc.oneof(fc.constantFrom(undefined, 0, 1, 2), fc.constantFrom(0, 1, 2).map((px) => ({ px })));
  const stroke: fc.Arbitrary<Stroke> = fc.record({
    paint: fc.option(solid, { nil: undefined }),
    width,
    join: fc.constantFrom(undefined, 'miter' as const, 'round' as const),
    cap: fc.constantFrom(undefined, 'butt' as const, 'round' as const),
    miterLimit: fc.constantFrom(undefined, 4, 10),
    align: fc.constantFrom(undefined, 'center' as const, 'inner' as const),
    dash: fc.constantFrom(undefined, [] as number[], [2, 1]),
  }, { requiredKeys: [] });

  /** A stroke with every default spelled out, as the key reads it. */
  const filled = (s: Stroke) => ({
    width: s.width ?? 1, join: s.join ?? 'miter', cap: s.cap ?? 'butt', miterLimit: s.miterLimit ?? 4,
    align: s.align ?? 'center', dash: s.dash ?? [], paint: s.paint && drawsAs(s.paint),
  });

  /** The same stroke with every default written in. */
  const filledOut = (s: Stroke): Stroke => ({
    ...s, width: s.width ?? 1, join: s.join ?? 'miter', cap: s.cap ?? 'butt', miterLimit: s.miterLimit ?? 4,
    align: s.align ?? 'center', dash: s.dash ?? [],
  });

  it('keys strokes alike exactly when they put down the same ink, defaults spelled out or not', () => {
    const t = tally();
    const strokes = fc.oneof(fc.tuple(stroke, stroke), stroke.map((s) => [s, filledOut(s)] as [Stroke, Stroke]));
    fc.assert(fc.property(strokes, ([a, b]) => {
      const ka = strokeKey(a), kb = strokeKey(b);
      expect(ka === 'none').toBe(!strokeHasInk(a));
      if (!strokeHasInk(a) || !strokeHasInk(b)) return;
      t.count(ka === kb ? 'alike' : 'apart');
      expect(ka === kb).toBe(plain(filled(a)) === plain(filled(b)));
      expect(strokeKey(respelled(a))).toBe(ka);
    }), RUNS);
    t.atLeast('alike', 1);
    t.atLeast('apart', 1);
  });
});
