/**
 * Metamorphic properties of the ongoing actions, each driven through its invoker on a real scene: moving the scene
 * and the pointer together moves the result with them; a gesture split into more moves reaches the same end; a
 * pointer that is no number lands nowhere; and undo puts back exactly what was there. Move, resize, rotate, and clone
 * over marks and over a turned group at any scale down to subnormal; the marquee and insert over the same laws.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Action, ActionDeps, BindingOptions } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import type { RectPose } from 'core/geometry/rectPose';
import { hitTestArea } from 'canvas/deps/hitTestArea';
import { moveAction } from './move/action';
import { resizeAction } from './resize/action';
import { rotateAction } from './rotate/action';
import { cloneAction } from './clone/action';
import { areaSelectAction } from './defaults/areaSelect';
import { insertAction } from './insert/action';
import { scenePoseFrame } from './poseFrame';
import { depsOf, makeScene, runs, tally, type TestScene } from './pbt.fixture';
import { assertFinite, drive, type Gesture, type Pt } from './drag.pbt.fixture';

const N = 100;
const seen = tally();

interface World { poses: RectPose[]; group: { pose: RectPose; members: number } | null; picks: number[] }

/** The scene `w` describes, every root moved by `t`, with the picks selected. */
function build(w: World, t: Pt): { scene: TestScene; ids: NodeId[] } {
  const scene = makeScene();
  const at = (p: RectPose): RectPose => ({ ...p, x: p.x + t.x, y: p.y + t.y });
  const ids: NodeId[] = [];
  const g = w.group ? scene.add({ kind: 'group', layer: 'main', pose: at(w.group.pose), data: {} }) : null;
  w.poses.forEach((p, i) => {
    const inGroup = g !== null && i < w.group!.members;
    ids.push(scene.add({ kind: 'mark', layer: 'main', pose: inGroup ? p : at(p), data: {}, ...(inGroup ? { parent: g } : {}) }));
  });
  if (g) ids.push(g);
  scene.setSelection([...new Set(w.picks.map((k) => ids[k % ids.length]!))]);
  return { scene, ids };
}

/** Every node's world pose, in insertion order. */
function worlds(scene: TestScene): unknown[] {
  const frame = scenePoseFrame(scene as never);
  return [...scene.nodes.keys()].map((id) => frame.world(id));
}

const TAU = 2 * Math.PI;
/** Whether `b` is `a` moved by `t`, within rounding at `scale`, its turn compared a whole turn apart. */
function movedBy(a: unknown, b: unknown, t: Pt, scale: number, key = ''): string | null {
  if (typeof a === 'number' && typeof b === 'number') {
    const want = key === 'x' ? a + t.x : key === 'y' ? a + t.y : a;
    let d = Math.abs(b - want);
    if (key === 'rotation') d = Math.min(d % TAU, TAU - (d % TAU));
    return d <= 1e-9 * Math.max(1, scale) ? null : `${key}: ${b} vs ${want}`;
  }
  if (a === null || typeof a !== 'object' || b === null || typeof b !== 'object') return Object.is(a, b) ? null : `${key}: ${String(b)} vs ${String(a)}`;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const va = (a as Record<string, unknown>)[k] ?? (k === 'rotation' ? 0 : undefined);
    const vb = (b as Record<string, unknown>)[k] ?? (k === 'rotation' ? 0 : undefined);
    const bad = movedBy(va, vb, Array.isArray(a) ? { x: 0, y: 0 } : t, scale, Array.isArray(a) ? key : k);
    if (bad) return `${key}.${bad}`;
  }
  return null;
}

const tinyGroup = (w: World): boolean => (w.group?.pose.transform?.[0] ?? 1) < 1e-12;
const shift = (p: Pt, t: Pt): Pt => ({ x: p.x + t.x, y: p.y + t.y });

interface Variant { name: string; action: Action; handle?: boolean }
const VARIANTS: Variant[] = [
  { name: 'move', action: moveAction },
  { name: 'resize', action: resizeAction, handle: true },
  { name: 'rotate', action: rotateAction },
  { name: 'clone', action: cloneAction },
];

const coord = fc.integer({ min: -200, max: 200 });
const pt = fc.record({ x: coord, y: coord });
const rect = fc.record({
  x: coord, y: coord, width: fc.integer({ min: 1, max: 60 }), height: fc.integer({ min: 1, max: 60 }),
  rotation: fc.option(fc.constantFrom(Math.PI / 6, -Math.PI / 4, 1), { nil: undefined, freq: 3 }),
}).map((p) => (p.rotation === undefined ? { x: p.x, y: p.y, width: p.width, height: p.height } : p) as RectPose);
const groupPose = fc.tuple(rect, fc.constantFrom(1, 0.5, 1e-200, 1e-310), fc.constantFrom(0, 0.7, Math.PI / 2))
  .map(([p, s, rotation]) => ({ ...p, rotation, ...(s === 1 ? {} : { transform: [s, 0, 0, s] as const }) }) as RectPose);
const world = fc.record({
  poses: fc.array(rect, { minLength: 1, maxLength: 4 }),
  group: fc.option(fc.record({ pose: groupPose, members: fc.integer({ min: 1, max: 2 }) }), { nil: null, freq: 3 }),
  picks: fc.array(fc.nat({ max: 9 }), { minLength: 1, maxLength: 3 }),
});
const offset = fc.record({
  x: fc.oneof(fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: -1e6, max: 1e6 })),
  y: fc.oneof(fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: -1e6, max: 1e6 })),
});
const variant = fc.nat({ max: VARIANTS.length - 1 }).map((i) => VARIANTS[i]!);
const handle = fc.nat({ max: 7 });

function run(v: Variant, w: World, t: Pt, g: Omit<Gesture, 'handle'>, h: number): { scene: TestScene; at: number } {
  const { scene } = build(w, t);
  const at = scene.historyIndex();
  drive(v.action, depsOf(scene), {
    start: shift(g.start, t), path: g.path.map((p) => shift(p, t)), reason: g.reason, ...(v.handle ? { handle: h } : {}),
  });
  return { scene, at };
}

describe('ongoing actions, metamorphic properties', () => {
  it('moving the scene and the pointer together moves the result with them', () => {
    fc.assert(fc.property(variant, world, offset, pt, fc.array(pt, { minLength: 1, maxLength: 8 }), handle, (v, w, t, start, path, h) => {
      // A resize remaps in world, where a box drawn at a scale far below rounding has no precision left to move in
      // (docs/unruled.md, 2026-11-11).
      fc.pre(!(v.name === 'resize' && tinyGroup(w)));
      const g = { start, path, reason: 'commit' as const };
      const a = run(v, w, { x: 0, y: 0 }, g, h);
      const b = run(v, w, t, g, h);
      expect(b.scene.historyIndex() - b.at, `${v.name} records alike`).toBe(a.scene.historyIndex() - a.at);
      const wa = worlds(a.scene);
      const wb = worlds(b.scene);
      expect(wb.length).toBe(wa.length);
      const scale = 1000 + Math.abs(t.x) + Math.abs(t.y);
      wa.forEach((p, i) => expect(movedBy(p, wb[i], t, scale), `${v.name} node ${i}`).toBeNull());
      seen.count(a.scene.historyIndex() > a.at ? `translate:${v.name}` : `translate:idle:${v.name}`);
      if (w.group && a.scene.historyIndex() > a.at) seen.count('translate:group');
    }), runs(N));
    for (const v of VARIANTS) expect(seen.get(`translate:${v.name}`), seen.dump()).toBeGreaterThan(runs(N).numRuns / 20);
  });

  it('a gesture split into more moves reaches the same end', () => {
    fc.assert(fc.property(variant, world, pt, fc.array(pt, { minLength: 0, maxLength: 8 }), pt, handle, (v, w, start, via, end, h) => {
      const zero = { x: 0, y: 0 };
      const once = run(v, w, zero, { start, path: [end], reason: 'commit' }, h);
      const split = run(v, w, zero, { start, path: [...via, end], reason: 'commit' }, h);
      const wa = worlds(once.scene);
      const wb = worlds(split.scene);
      wa.forEach((p, i) => expect(movedBy(p, wb[i], zero, 1000), `${v.name} node ${i}`).toBeNull());
      seen.count(once.scene.historyIndex() > once.at ? `split:${v.name}` : `split:idle:${v.name}`);
    }), runs(N));
    for (const v of VARIANTS) expect(seen.get(`split:${v.name}`), seen.dump()).toBeGreaterThan(runs(N).numRuns / 20);
  });

  it('a move to a point that is no number lands nowhere, and undo puts back exactly what was there', () => {
    const wild = fc.record({ x: fc.oneof({ weight: 3, arbitrary: coord }, { weight: 1, arbitrary: fc.constantFrom(Number.NaN, Infinity, -Infinity) }), y: fc.oneof({ weight: 3, arbitrary: coord }, { weight: 1, arbitrary: fc.constantFrom(Number.NaN, Infinity) }) });
    fc.assert(fc.property(variant, world, wild, fc.array(wild, { minLength: 1, maxLength: 8 }), handle, (v, w, start, path, h) => {
      const zero = { x: 0, y: 0 };
      const finite = (p: Pt) => Number.isFinite(p.x) && Number.isFinite(p.y);
      // A press that is no number presses nothing, so nothing moves.
      const landed = finite(start) ? path.filter(finite) : [];
      const real = run(v, w, zero, { start, path, reason: 'commit' }, h);
      assertFinite(real.scene.toJSON(), v.name);
      // Only the points that are numbers, ending at the last of them.
      const kept = run(v, w, zero, { start: finite(start) ? start : zero, path: landed, reason: 'commit' }, h);
      const wa = worlds(kept.scene);
      worlds(real.scene).forEach((p, i) => expect(movedBy(wa[i], p, zero, 1000), `${v.name} node ${i}`).toBeNull());
      const before = build(w, zero).scene;
      while (real.scene.historyIndex() > real.at) real.scene.undo();
      expect(worlds(real.scene), `${v.name} undone`).toEqual(worlds(before));
      seen.count(landed.length < path.length ? `wild:${v.name}` : 'wild:tame');
      if (!finite(start)) seen.count('wild:press');
    }), runs(N));
    for (const what of [...VARIANTS.map((v) => `wild:${v.name}`), 'wild:press']) expect(seen.get(what), seen.dump()).toBeGreaterThan(runs(N).numRuns / 20);
  });
});

describe('the marquee and insert, metamorphic properties', () => {
  function marquee(w: World, t: Pt, start: Pt, path: Pt[], shiftHeld: boolean): string[] {
    const { scene, ids } = build(w, t);
    const deps = {
      ...depsOf(scene),
      areaSelect: {
        hitTestArea: (b: { x: number; y: number; width: number; height: number }) => hitTestArea(scene as never, b),
        getSelection: () => [...scene.getSelection()],
        setSelection: (next: NodeId[]) => scene.setSelection(next),
      },
    } as unknown as ActionDeps;
    const mods = { alt: false, ctrl: false, meta: false, shift: shiftHeld };
    const inv = areaSelectAction.invoker as Extract<Action['invoker'], { timing: 'ongoing' }>;
    const ctx = (p: Pt) => ({ world: shift(p, t), screen: p, modifiers: mods, deps });
    const hnd = inv.start(ctx(start) as never, undefined);
    for (const p of path) hnd.onMove?.(ctx(p) as never);
    hnd.onEnd?.(ctx(path.at(-1) ?? start) as never, 'commit');
    return [...scene.getSelection()].map((id) => String(ids.indexOf(id))).sort();
  }

  it('a marquee takes the same nodes moved with the pointer, and past points that are no number', () => {
    const wild = fc.oneof({ weight: 4, arbitrary: pt }, { weight: 1, arbitrary: fc.record({ x: fc.constantFrom(Number.NaN, Infinity), y: coord }) });
    fc.assert(fc.property(world, offset, pt, fc.array(wild, { minLength: 1, maxLength: 6 }), fc.boolean(), (w, t, start, path, s) => {
      const tame = path.filter((p) => Number.isFinite(p.x));
      const a = marquee(w, { x: 0, y: 0 }, start, tame, s);
      expect(marquee(w, t, start, tame, s)).toEqual(a);
      expect(marquee(w, { x: 0, y: 0 }, start, path, s)).toEqual(a);
      seen.count(a.length > 0 ? 'marquee:took' : 'marquee:none');
    }), runs(N));
    expect(seen.get('marquee:took'), seen.dump()).toBeGreaterThan(runs(N).numRuns / 10);
  });

  /** What insert hands its dep: the bounds of each commit. */
  function insert(kind: string, t: Pt, start: Pt, path: readonly Pt[], reason: 'commit' | 'cancel'): unknown[] {
    const calls: unknown[] = [];
    const deps = { insert: { commit: (bounds: unknown) => { calls.push(bounds); return 'n' as NodeId; } } } as unknown as ActionDeps;
    const opts: BindingOptions = { params: { kind } };
    drive(insertAction, deps, { start: shift(start, t), path: path.map((p) => shift(p, t)), reason, opts });
    return calls;
  }
  const kind = fc.constantFrom('rect', 'ellipse', 'line', 'polygon', 'star', 'text');

  it('an insert lands alike moved, split, or past points that are no number, and a canceled one lands nothing', () => {
    const wild = fc.record({ x: fc.oneof(coord, fc.constantFrom(Number.NaN, Infinity)), y: fc.oneof(coord, fc.constantFrom(Number.NaN, -Infinity)) });
    fc.assert(fc.property(kind, offset, pt, fc.array(wild, { minLength: 0, maxLength: 6 }), pt, (k, t, start, via, end) => {
      const zero = { x: 0, y: 0 };
      const once = insert(k, zero, start, [end], 'commit');
      const moved = insert(k, t, start, [end], 'commit');
      expect(moved.length).toBe(once.length);
      once.forEach((b, i) => expect(movedBy(b, moved[i], t, 1000 + Math.abs(t.x) + Math.abs(t.y)), k).toBeNull());
      const split = insert(k, zero, start, [...via, end], 'commit');
      expect(split.length).toBe(once.length);
      once.forEach((b, i) => expect(movedBy(b, split[i], zero, 1000), `${k} split`).toBeNull());
      split.forEach((b) => assertFinite(b, k));
      expect(insert(k, zero, start, [...via, end], 'cancel')).toEqual([]);
      // Ending on a point that is no number ends where the last that was left it.
      const tame = [...via, end].filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
      const ragged = insert(k, zero, start, [...via, end, { x: Number.NaN, y: end.y }], 'commit');
      expect(ragged.length).toBe(insert(k, zero, start, tame, 'commit').length);
      insert(k, zero, start, tame, 'commit').forEach((b, i) => expect(movedBy(b, ragged[i], zero, 1000), `${k} ragged`).toBeNull());
      seen.count(once.length > 0 ? 'insert:landed' : 'insert:none');
    }), runs(N));
    expect(seen.get('insert:landed'), seen.dump()).toBeGreaterThan(runs(N).numRuns / 2);
  });
});
