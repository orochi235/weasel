/**
 * Stateful property test of the retained-surface store: random frames of lookups, reserves with commits, budget
 * changes, and buffer resizes, against a device that only keeps books. After every step the store holds no texture
 * it does not count and counts none it does not hold, keeps its surfaces within the budget, frees nothing twice, and
 * hands back as kept only pixels drawn under the key asked for, or under one it moved by a translation.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { mat3, type GlMat3 } from '@weasel-js/geom';
import type { DrawCommand } from '../DrawCommand';
import type { GpuDevice, GpuTarget, GpuTargetDesc } from '../gpu/types';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { RetainedSurfaces, type RetainedKey } from './RetainedSurfaces';
import { keyShift, sameKey } from './retainedKey';

interface Books {
  live: Set<GpuTarget>;
  scratch: Set<GpuTarget>;
  errors: string[];
}

function bookDevice(samples: number): { gpu: GpuDevice; books: Books } {
  const books: Books = { live: new Set(), scratch: new Set(), errors: [] };
  const gpu = {
    limits: { samples },
    createTarget(desc: GpuTargetDesc): GpuTarget {
      const scratch = desc.stencil === true;
      if (!(desc.width > 0 && desc.height > 0)) books.errors.push(`target ${desc.width}x${desc.height}`);
      const t: GpuTarget = {
        kind: 'target', width: desc.width, height: desc.height, samples: desc.samples ?? 0,
        color: { kind: 'texture' } as never, ids: null, bytes: desc.width * desc.height * (scratch ? 8 : 4),
      };
      books.live.add(t);
      if (scratch) books.scratch.add(t);
      return t;
    },
    deleteTarget(t: GpuTarget): void {
      if (!books.live.delete(t)) books.errors.push('deleted a target twice, or one it never made');
      books.scratch.delete(t);
    },
    resolve(from: GpuTarget, to: GpuTarget, w: number, h: number, x: number, y: number): void {
      if (!books.live.has(from) || !books.live.has(to)) books.errors.push('resolved through a freed target');
      if (x < 0 || y < 0 || x + w > to.width || y + h > to.height) books.errors.push(`resolved ${w}x${h} at ${x},${y} into ${to.width}x${to.height}`);
      if (w > from.width || h > from.height) books.errors.push(`resolved ${w}x${h} out of a ${from.width}x${from.height} scratch`);
    },
  } as unknown as GpuDevice;
  return { gpu, books };
}

const CHILDREN: DrawCommand[][] = [[], [], []];
const COLOR = new Float32Array(20);
const SHIFTS = [0, 1, 2, 0.5, 40] as const;

/** A key from a small pool: which children, and a move along x drawn from a few, so keys repeat and shift. */
function keyOf(k: { child: number; dx: number; dy: number }): RetainedKey {
  const transform: GlMat3 = mat3.fromAffine([1, 0, 0, 1, SHIFTS[k.dx]!, SHIFTS[k.dy]!]);
  return { children: CHILDREN[k.child]!, transform, alpha: 1, colorMatrix: COLOR, viewMatrix: undefined, clips: [] };
}

const keyArb = fc.record({ child: fc.integer({ min: 0, max: 2 }), dx: fc.integer({ min: 0, max: 4 }), dy: fc.integer({ min: 0, max: 4 }) });
const ids = fc.constantFrom('a', 'b');
const ms = fc.oneof({ weight: 4, arbitrary: fc.constant(true) }, { weight: 1, arbitrary: fc.constant(false) });

interface Sys {
  store: RetainedSurfaces;
  books: Books;
  budget: number;
  committed: Map<string, RetainedKey>;
  size: readonly [number, number];
  frameOpen: boolean;
  t: ReturnType<typeof tally>;
}

function check(s: Sys): void {
  expect(s.books.errors).toEqual([]);
  let surfaces = 0, scratch = 0;
  for (const t of s.books.live) {
    if (s.books.scratch.has(t)) scratch += t.bytes; else surfaces += t.bytes;
  }
  expect(s.store.bytes, 'bytes counted against targets held').toBe(surfaces + scratch);
  expect(surfaces, 'surfaces past the budget').toBeLessThanOrEqual(s.budget);
  expect(s.books.scratch.size).toBeLessThanOrEqual(2);
}

type Cmd = fc.Command<object, Sys>;
const cmd = (name: string, run: (s: Sys) => void): Cmd => ({
  check: () => true,
  run: (_m, s) => { run(s); check(s); },
  toString: () => name,
});

const begin = fc.oneof({ weight: 5, arbitrary: fc.constant(0) }, { weight: 1, arbitrary: fc.constant(1) }).map((v) => cmd(`begin(${v})`, (s) => {
  if (s.frameOpen) s.store.endFrame();
  s.store.beginFrame([v]);
  s.frameOpen = true;
}));

const end = fc.constant(cmd('end', (s) => {
  if (!s.frameOpen) return;
  s.store.endFrame();
  s.frameOpen = false;
}));

/** The key last committed for `id`, moved by `by` CSS pixels, or `fallback` when none was. */
function moved(s: Sys, id: string, by: readonly [number, number] | null, fallback: RetainedKey): RetainedKey {
  const was = s.committed.get(id);
  if (!was || by === null) return fallback;
  const m = was.transform;
  return { ...was, transform: mat3.fromAffine([m[0]!, m[1]!, m[3]!, m[4]!, m[6]! + by[0], m[7]! + by[1]]) };
}

const lookup = fc.record({
  id: ids, key: keyArb, scale: fc.option(fc.constantFrom(1, 2), { nil: undefined }), ms,
  by: fc.oneof(fc.constant([0, 0] as const), fc.constantFrom([1, 0] as const, [0, -3] as const, [0.5, 0] as const, [30, 30] as const, [-100, 0] as const), fc.constant(null)),
}).map(({ id, key, scale, ms, by }) => cmd(`lookup(${id}, ${by ? `moved ${by}` : JSON.stringify(key)}, ${scale}, ${ms})`, (s) => {
    const [w, h] = s.size;
    const k = moved(s, id, by, keyOf(key));
    const got = s.store.lookup(id, w, h, k, ms, scale);
    s.t.count(`lookup:${got.kind}`);
    if (got.kind !== 'kept') return;
    const was = s.committed.get(id);
    expect(was, 'kept pixels never committed').toBeDefined();
    if (!sameKey(was!, k)) {
      s.t.count('kept moved');
      expect(scale, 'kept a moved key with no scale to move by').toBeDefined();
      expect(keyShift(was!, k)).not.toBeNull();
    }
    const { texture, rect } = got.pixels;
    if (rect.width === 0 || rect.height === 0) { expect(texture).toBeNull(); return; }
    const target = [...s.books.live].find((t) => t.color === texture);
    expect(target, 'kept a freed texture').toBeDefined();
    expect([target!.width, target!.height]).toEqual([rect.width, rect.height]);
  }));

const rectIn = (w: number, h: number) => fc.record({
  x: fc.integer({ min: 0, max: w }), y: fc.integer({ min: 0, max: h }), w: fc.integer({ min: 0, max: w }), h: fc.integer({ min: 0, max: h }),
}).map((r) => ({ x: r.x, y: r.y, width: Math.min(r.w, w - r.x), height: Math.min(r.h, h - r.y) }));

const reserve = fc.record({
  id: ids, key: keyArb, rect: rectIn(64, 48), ms, reach: fc.boolean(), commit: fc.oneof({ weight: 4, arbitrary: fc.constant(true) }, { weight: 1, arbitrary: fc.constant(false) }),
}).map(({ id, key, rect, ms, reach, commit }) => cmd(`reserve(${id}, ${JSON.stringify(rect)}, ${ms}, ${reach}, ${commit})`, (s) => {
  const [w, h] = s.size;
  const r = { ...rect, width: Math.min(rect.width, w - rect.x), height: Math.min(rect.height, h - rect.y) };
  if (r.width < 0 || r.height < 0) return;
  const box = { x0: r.x - 20, y0: r.y - 20, x1: r.x + r.width + 20, y1: r.y + r.height + 20 };
  const draw = s.store.reserve(id, w, h, r, ms, reach ? { box, window: { x: 0, y: 0, width: w, height: h } } : undefined);
  s.t.count(draw ? 'reserved' : 'refused');
  if (!draw) {
    // A refusal leaves whatever was there; a resize may already have dropped it.
    return;
  }
  for (const tile of draw.tiles) draw.resolve(tile);
  const covered = draw.tiles.reduce((n, t) => n + t.width * t.height, 0);
  expect(covered).toBe(draw.target ? draw.rect.width * draw.rect.height : 0);
  if (!commit) { s.committed.delete(id); return; }
  const k = keyOf(key);
  draw.commit(k);
  s.committed.set(id, k);
  const again = s.store.lookup(id, w, h, k, ms);
  expect(again.kind, 'a surface just committed is not kept').toBe('kept');
  s.t.count('committed');
}));

const budget = fc.constantFrom(64 * 48 * 4 * 3, 64 * 48 * 4, 2000, 0).map((b) => cmd(`budget(${b})`, (s) => {
  s.store.setBudget(b);
  s.budget = b;
}));

const resize = fc.constantFrom([64, 48] as const, [40, 40] as const).map((size) => cmd(`resize(${size})`, (s) => { s.size = size; }));

const tile = fc.constantFrom(1024, 16, 7).map((n) => cmd(`tile(${n})`, (s) => { s.store.tile = n; }));

describe('RetainedSurfaces, stateful property', () => {
  it('keeps its books, its budget, and only pixels drawn under the key asked for', () => {
    const t = tally();
    fc.assert(fc.property(
      fc.constantFrom(0, 4), fc.constantFrom(64 * 48 * 4 * 3, 64 * 48 * 4),
      fc.commands([begin, end, lookup, lookup, lookup, reserve, reserve, budget, tile, resize], { maxCommands: 60, size: 'large' }),
      (samples, b, cmds) => {
        const { gpu, books } = bookDevice(samples);
        const s: Sys = { store: new RetainedSurfaces(gpu, b), books, budget: b, committed: new Map(), size: [64, 48], frameOpen: false, t };
        s.store.beginFrame([0]);
        s.frameOpen = true;
        fc.modelRun(() => ({ model: {}, real: s }), cmds);
        s.store.releaseAll();
        expect(books.live.size, 'targets left after releaseAll').toBe(0);
        expect(books.errors).toEqual([]);
      },
    ), runs(200));
    for (const k of ['lookup:kept', 'lookup:redraw', 'lookup:through', 'reserved', 'refused', 'committed', 'kept moved']) t.atLeast(k, 10);
  }, timeoutFor(200, 20));
});
