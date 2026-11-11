/**
 * Stateful property test of the loupe model: random aims, picks, factor and mode writes, resamples, landed frames,
 * and changes to the surface under it (hidden, covering, repainted, a lens moved or taken away, gone for good),
 * against a model of what it holds. Every step checks the aim, factor, mode, and color, the colors reported, the
 * picks reported, how often the surface was told to redraw, and that the surface was never sampled at a
 * non-finite point.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { normalizeZoom } from '@weasel-js/geom';
import { createLoupeModel, type LoupeMode, type LoupeSurface } from './model';
import { loupeSourcePoint, type LoupePoint, type LoupeRect } from './geometry';
import { coord, factor, lensRect, point, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 200;

type Lens = (LoupeRect & { shows?: LoupePoint; factor?: number }) | null;

interface World {
  hidden: boolean;
  gone: boolean;
  /** The lens covers points with `x` in this range. */
  covered: [number, number] | null;
  palette: number;
  lens: Lens;
}

const cell = (n: number) => Math.floor(n / 50);
function colorAt(w: World, p: LoupePoint): string | null {
  const i = cell(p.x);
  const j = cell(p.y);
  if (((i % 4) + 4) % 4 === 0) return null;
  const h = (Math.abs(i * 73 + j * 19 + w.palette * 7) % 0xffffff).toString(16).padStart(6, '0');
  return `#${h}`;
}
const coversAt = (w: World, p: LoupePoint) => w.covered !== null && p.x >= w.covered[0] && p.x <= w.covered[1];

type Op =
  | { op: 'aim'; p: LoupePoint }
  | { op: 'pick'; p?: LoupePoint }
  | { op: 'factor'; f: number }
  | { op: 'mode'; mode: LoupeMode }
  | { op: 'resample' }
  | { op: 'frame' }
  | { op: 'hide'; hidden: boolean }
  | { op: 'cover'; covered: [number, number] | null }
  | { op: 'repaint' }
  | { op: 'lens'; lens: Lens }
  | { op: 'gone' }
  | { op: 'dispose' };

const near = fc.record({ x: coord(400), y: coord(400) });
const opArb: fc.Arbitrary<Op> = fc.oneof(
  { weight: 30, arbitrary: near.map((p) => ({ op: 'aim' as const, p })) },
  { weight: 15, arbitrary: fc.option(fc.oneof(near, point), { nil: undefined }).map((p) => ({ op: 'pick' as const, ...(p ? { p } : {}) })) },
  { weight: 10, arbitrary: fc.oneof(factor, fc.constantFrom(0, -1, Infinity, NaN, 8)).map((f) => ({ op: 'factor' as const, f })) },
  { weight: 5, arbitrary: fc.constantFrom<LoupeMode>('vector', 'pixel').map((mode) => ({ op: 'mode' as const, mode })) },
  { weight: 10, arbitrary: fc.constant({ op: 'resample' as const }) },
  { weight: 10, arbitrary: fc.constant({ op: 'frame' as const }) },
  { weight: 5, arbitrary: fc.boolean().map((hidden) => ({ op: 'hide' as const, hidden })) },
  { weight: 5, arbitrary: fc.option(fc.tuple(coord(400), fc.double({ min: 0, max: 300, noNaN: true })).map(([a, w]) => [a, a + w] as [number, number])).map((covered) => ({ op: 'cover' as const, covered })) },
  { weight: 10, arbitrary: fc.constant({ op: 'repaint' as const }) },
  { weight: 5, arbitrary: fc.option(fc.record({ rect: lensRect, shows: fc.option(near, { nil: undefined }), factor: fc.option(factor, { nil: undefined }) })
    .map(({ rect, shows, factor: f }) => ({ ...rect, ...(shows ? { shows } : {}), ...(f !== undefined ? { factor: f } : {}) })))
    .map((lens) => ({ op: 'lens' as const, lens })) },
  { weight: 1, arbitrary: fc.constant({ op: 'gone' as const }) },
  { weight: 1, arbitrary: fc.constant({ op: 'dispose' as const }) },
);

const bounds = fc.option(fc.tuple(fc.double({ min: 0.5, max: 8, noNaN: true }), fc.double({ min: 1, max: 64, noNaN: true }))
  .map(([lo, k]) => ({ minFactor: lo, maxFactor: lo * k })), { nil: undefined });

describe('createLoupeModel', () => {
  it('holds what a model of it holds through any run of aims, picks, writes, and surface changes', () => {
    const seen = tally();
    fc.assert(fc.property(fc.boolean(), fc.option(factor, { nil: undefined }), bounds, fc.array(opArb, { minLength: 15, maxLength: 40 }),
      (framed, initial, range, ops) => {
        const world: World = { hidden: false, gone: false, covered: null, palette: 0, lens: { x: 0, y: 0, w: 100, h: 100 } };
        const frameFns = new Set<() => void>();
        const bad: LoupePoint[] = [];
        let redraws = 0;
        const surface: LoupeSurface = {
          lens: () => world.lens,
          covers: (p) => coversAt(world, p),
          sample: (p) => { if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) bad.push(p); return colorAt(world, p); },
          hidden: () => world.hidden,
          gone: () => world.gone,
          changed: () => { redraws++; },
          ...(framed ? { subscribeFrame: (fn: () => void) => { frameFns.add(fn); return () => frameFns.delete(fn); } } : {}),
        };
        const colors: (string | null)[] = [];
        const picks: string[] = [];
        let disposals = 0;
        const loupe = createLoupeModel({
          surface, ...(initial !== undefined ? { factor: initial } : {}), ...range,
          onColorChange: (hex) => colors.push(hex), onPick: (hex) => picks.push(hex), onDispose: () => { disposals++; },
        });

        const m = {
          aim: { x: 0, y: 0 } as LoupePoint, factor: normalizeZoom(initial ?? 8), mode: 'vector' as LoupeMode,
          color: null as string | null, disposed: false, unsampled: false, colors: [] as (string | null)[], picks: [] as string[],
          redraws: 0, disposals: 0,
        };
        const clamp = (n: number) => normalizeZoom(Math.min(range?.maxFactor ?? Infinity, Math.max(range?.minFactor ?? -Infinity, n)));
        const sampleAim = () => {
          const hex = colorAt(world, m.aim);
          if (hex === m.color) return;
          m.color = hex;
          m.colors.push(hex);
        };
        const teardown = () => {
          if (m.disposed) return;
          m.disposed = true;
          m.disposals++;
          if (framed) expect(frameFns.size).toBe(0);
        };

        for (const o of ops) {
          seen.count(o.op);
          switch (o.op) {
            case 'aim':
              loupe.aimAt(o.p);
              if (m.disposed) break;
              if (world.gone) { teardown(); break; }
              if (world.hidden || coversAt(world, o.p)) { seen.count('aim ignored'); break; }
              m.aim = o.p;
              if (framed) m.unsampled = true;
              else sampleAim();
              m.redraws++;
              break;
            case 'pick': {
              const got = loupe.pick(o.p);
              let want: string | null;
              if (m.disposed) want = null;
              else if (!o.p) want = colorAt(world, m.aim);
              else if (!world.lens) want = null;
              else {
                const at = loupeSourcePoint(o.p, world.lens, world.lens.shows ?? m.aim, world.lens.factor ?? m.factor);
                want = coversAt(world, at) ? null : colorAt(world, at);
              }
              expect(got).toBe(want);
              if (want !== null) { m.picks.push(want); seen.count('picked'); }
              break;
            }
            case 'factor': {
              loupe.setFactor(o.f);
              if (m.disposed) break;
              const next = clamp(o.f);
              if (next !== m.factor) { m.factor = next; m.redraws++; } else seen.count('same factor');
              break;
            }
            case 'mode':
              loupe.setMode(o.mode);
              if (!m.disposed && o.mode !== m.mode) { m.mode = o.mode; m.redraws++; }
              break;
            case 'resample':
              loupe.resample();
              if (m.disposed || world.hidden) break;
              m.unsampled = false;
              sampleAim();
              break;
            case 'frame':
              for (const fn of [...frameFns]) fn();
              if (framed && !m.disposed && m.unsampled) { m.unsampled = false; sampleAim(); seen.count('landed'); }
              break;
            case 'hide': world.hidden = o.hidden; break;
            case 'cover': world.covered = o.covered; break;
            case 'repaint': world.palette++; break;
            case 'lens': world.lens = o.lens; break;
            case 'gone': world.gone = true; break;
            case 'dispose': loupe.dispose(); teardown(); break;
          }
          expect(loupe.aim).toEqual(m.aim);
          expect(loupe.factor).toBe(m.factor);
          expect(Number.isFinite(loupe.factor) && loupe.factor > 0).toBe(true);
          expect(loupe.mode).toBe(m.mode);
          expect(loupe.color).toBe(m.color);
          expect(colors).toEqual(m.colors);
          expect(picks).toEqual(m.picks);
          expect(redraws).toBe(m.redraws);
          expect(disposals).toBe(m.disposals);
          expect(bad).toEqual([]);
        }
      }), runs(RUNS));
    for (const what of ['aim', 'pick', 'picked', 'factor', 'resample', 'aim ignored']) seen.atLeast(what, RUNS / 2);
    for (const what of ['same factor', 'landed', 'dispose', 'gone']) seen.atLeast(what, RUNS / 10);
  }, timeoutFor(RUNS, 20));
});
