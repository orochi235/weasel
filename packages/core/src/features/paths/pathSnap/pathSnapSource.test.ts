import { describe, expect, it } from 'vitest';
import { pathFromD } from '@weasel-js/geom';
import { asNodeId, type Scene } from 'core/scene/types';
import type { SnapBegin, SnapMods } from 'interactions/actions/snapDep';
import { createSnapOutcomeStore } from 'features/snap/outcomeStore';
import { createSession2d } from 'features/snap/session2d';
import type { SnapCollect, SnapSource } from 'features/snap/types';
import { ownGeometryAt, pathSnapSource, type PathSnapSourceOptions } from './pathSnapSource';
import { createSceneSnapIndexer } from './sceneIndex';

const FREE: SnapMods = { suspend: false, constrain: false };
const ONE = { x: 1, y: 1 };

function sceneOf(paths: Record<string, string>) {
  const nodes = new Map(Object.entries(paths).map(([id, d]) => [
    asNodeId(id), { id: asNodeId(id), kind: 'leaf' as const, layer: 'default', parent: null, pose: pathFromD(d), data: {} },
  ]));
  return { nodes, layers: [{ id: 'default' }], getVersion: () => 1 } as unknown as Scene<unknown, string, unknown>;
}

function run(
  scene: Scene<unknown, string, unknown>, opts: PathSnapSourceOptions, req: Partial<SnapBegin>,
  at: { x: number; y: number }, env: { reach?: number; scale?: number } = {},
) {
  const press = at;
  const scale = { x: env.scale ?? 1, y: env.scale ?? 1 };
  const full: SnapBegin = { gesture: 'point', press, ...req };
  const store = createSnapOutcomeStore();
  const s = createSession2d({
    req: full,
    sources: [pathSnapSource(opts)],
    probes: [{ id: 'pointer', at: press, role: 'pointer' }],
    view: () => ({ x: 0, y: 0, scale }),
    reachPx: env.reach ?? 8,
    scene,
    store,
  });
  return s.at(at, FREE);
}

const cross = sceneOf({ a: 'M0 0 L100 100', b: 'M0 100 L100 0' });

describe('pathSnapSource', () => {
  it('lands on an intersection in range and marks it with its kind and label', () => {
    const out = run(cross, {}, {}, { x: 51, y: 50 });
    expect(out.point).toEqual({ x: expect.closeTo(50, 9), y: expect.closeTo(50, 9) });
    expect(out.held).toBe(true);
    expect(out.marks).toContainEqual({ kind: 'point', at: { x: 50, y: 50 }, glyph: 'intersection', label: 'intersection' });
  });

  it('measures reach in screen pixels, and takes its own reach', () => {
    const only = { kinds: { nearest: false, midpoint: false } };
    expect(run(cross, only, {}, { x: 55, y: 50 }).held).toBe(true);
    expect(run(cross, only, {}, { x: 65, y: 50 }).held).toBe(false);
    expect(run(cross, { ...only, reachPx: 20 }, {}, { x: 65, y: 50 }).held).toBe(true);
  });

  it('turns a kind off', () => {
    const out = run(cross, { kinds: { intersection: false, nearest: false, midpoint: false } }, {}, { x: 51, y: 50 });
    expect(out.held).toBe(false);
  });

  it('breaks an equal-distance tie by the order it emits: an anchor before a midpoint', () => {
    const line = sceneOf({ a: 'M0 0 L10 0' });
    const out = run(line, { reachPx: 20 }, {}, { x: 2.5, y: 0 });
    expect(out.point).toEqual({ x: expect.closeTo(0, 9), y: expect.closeTo(0, 9) });
    expect(out.marks).toEqual([{ kind: 'point', at: { x: 0, y: 0 }, glyph: 'anchor', label: 'anchor' }]);
  });

  it('offers nearest only when no other kind is in range', () => {
    const line = sceneOf({ a: 'M0 0 L100 0' });
    const near = run(line, {}, {}, { x: 30, y: 4 });
    expect(near.marks).toMatchObject([{ glyph: 'nearest' }]);
    expect(near.point.x).toBeCloseTo(30, 9);
    expect(near.point.y).toBeCloseTo(0, 9);
    expect(run(line, {}, {}, { x: 52, y: 3 }).marks).toMatchObject([{ glyph: 'midpoint' }]);
  });

  it('finds a tangent from the origin, and none without one', () => {
    const circle = sceneOf({ c: 'M-10 0 A10 10 0 1 0 10 0 A10 10 0 1 0 -10 0 Z' });
    const only = { kinds: { anchor: false, quadrant: false, extremum: false, midpoint: false, nearest: false } };
    const withOrigin = run(circle, only, { origin: { x: 30, y: 0 } }, { x: 3.4, y: 9.4 });
    expect(withOrigin.marks).toMatchObject([{ glyph: 'tangent' }]);
    expect(Math.hypot(withOrigin.point.x, withOrigin.point.y)).toBeCloseTo(10, 1);
    expect(run(circle, only, {}, { x: 3.4, y: 9.4 }).held).toBe(false);
  });

  it("takes the canvas's reach when it sets none", () => {
    const line = sceneOf({ a: 'M0 0 L100 0' });
    // The anchor is 9.9px off: out at 8px, in at 12px.
    expect(run(line, {}, {}, { x: 7, y: 7 }, { reach: 12 }).marks).toMatchObject([{ glyph: 'anchor' }]);
    expect(run(line, {}, {}, { x: 7, y: 7 }).marks).toMatchObject([{ glyph: 'nearest' }]);
  });

  it('lets an anchor out of reach leave nearest on offer', () => {
    const line = sceneOf({ a: 'M0 0 L100 0' });
    // The anchor is 6.7px off, past a 5px reach; nearest is 3px off.
    expect(run(line, {}, {}, { x: 6, y: 3 }, { reach: 5 }).marks).toMatchObject([{ glyph: 'nearest' }]);
    expect(run(line, {}, {}, { x: 6, y: 3 }).marks).toMatchObject([{ glyph: 'anchor' }]);
  });

  it('measures that reach through the view scale', () => {
    const line = sceneOf({ a: 'M0 0 L100 0' });
    // The anchor is 4.6 world units off: 4.6px at scale 1, 9.2px at scale 2.
    expect(run(line, {}, {}, { x: 4.5, y: 1 }).marks).toMatchObject([{ glyph: 'anchor' }]);
    expect(run(line, {}, {}, { x: 4.5, y: 1 }, { scale: 2 }).marks).toMatchObject([{ glyph: 'nearest' }]);
  });

  it('drops a tangent within reach of its own origin', () => {
    const circle = sceneOf({ c: 'M-10 0 A10 10 0 1 0 10 0 A10 10 0 1 0 -10 0 Z' });
    const only = { kinds: { anchor: false, quadrant: false, extremum: false, midpoint: false, nearest: false } };
    // From (12, 0) the tangent point (8.3, 5.5) is 6.6 away: inside the 8px reach.
    expect(run(circle, only, { origin: { x: 12, y: 0 } }, { x: 8.3, y: 5.5 }).held).toBe(false);
  });

  it('offers nothing from a hidden or an annotation layer, or from a hidden node under a container', () => {
    const hiddenLayer = { ...cross, layers: [{ id: 'default', visible: false }] } as unknown as Scene<unknown, string, unknown>;
    expect(run(hiddenLayer, {}, {}, { x: 51, y: 50 }).held).toBe(false);
    const notes = { ...cross, layers: [{ id: 'default', annotation: true }] } as unknown as Scene<unknown, string, unknown>;
    expect(run(notes, {}, {}, { x: 51, y: 50 }).held).toBe(false);
    const live = sceneOf({ a: 'M0 0 L100 100', b: 'M0 100 L100 0' });
    const nodes = (live as unknown as { nodes: Map<unknown, Record<string, unknown>> }).nodes;
    const b = nodes.get(asNodeId('b'))!;
    nodes.set(asNodeId('g'), { ...b, id: asNodeId('g'), kind: 'container', hidden: true });
    nodes.set(asNodeId('b'), { ...b, parent: asNodeId('g') });
    expect(run(live, { kinds: { nearest: false, midpoint: false } }, {}, { x: 51, y: 50 }).held).toBe(false);
  });

  it('skips the nodes a gesture moves, and offers only the ones it includes', () => {
    const skipped = run(cross, { kinds: { nearest: false, midpoint: false } }, { ids: [asNodeId('b')] }, { x: 51, y: 50 });
    expect(skipped.held).toBe(false);
    const q = (extra: Partial<SnapCollect>) => {
      const src: SnapSource = pathSnapSource({ kinds: { nearest: false, anchor: false, intersection: false } });
      const base: SnapCollect = {
        gesture: 'point', probes: [{ id: 'pointer', at: { x: 50, y: 51 }, role: 'pointer' }],
        delta0: { x: 0, y: 0 }, exclude: [], reachWorld: (px) => px, reachPx: 8, scene: cross, ...extra,
      };
      return [...src.collect(base)];
    };
    expect(q({ include: ['b'] })).toHaveLength(1);
    expect(q({ include: [] })).toHaveLength(0);
    expect(q({ scene: undefined as never })).toHaveLength(0);
  });

  it('offers the geometry of its own `also` paths', () => {
    const out = run(sceneOf({}), { kinds: { nearest: false } }, { also: { anchors: [{ x: 40, y: 40 }] } }, { x: 43, y: 41 });
    expect(out.point).toEqual({ x: expect.closeTo(40, 9), y: expect.closeTo(40, 9) });
  });
});

describe('what a node offers to snap to', () => {
  const sceneWith = (pose: unknown, data: unknown) => ({
    nodes: new Map([[asNodeId('n'), { id: asNodeId('n'), kind: 'leaf' as const, layer: 'default', parent: null, pose, data }]]),
    layers: [{ id: 'default' }],
    getVersion: () => 1,
  }) as unknown as Scene<unknown, string, unknown>;

  it("gives a text node's box: its corners and its center", () => {
    const text = sceneWith({ x: 0, y: 0, width: 100, height: 40 }, { text: 'hi' });
    const only = { kinds: { nearest: false, midpoint: false } };
    expect(run(text, only, {}, { x: 51, y: 21 }).marks).toEqual([{ kind: 'point', at: { x: 50, y: 20 }, glyph: 'center', label: 'center' }]);
    expect(run(text, only, {}, { x: 98, y: 2 }).marks).toEqual([{ kind: 'point', at: { x: 100, y: 0 }, glyph: 'anchor', label: 'anchor' }]);
  });

  it('gives a filled rectangle its drawn outline', () => {
    const rect = sceneWith({ x: 10, y: 10, width: 50, height: 30 }, { fill: { paint: { color: '#000' } } });
    const only = { kinds: { nearest: false } };
    expect(run(rect, only, {}, { x: 58, y: 38 }).point).toEqual({ x: expect.closeTo(60, 9), y: expect.closeTo(40, 9) });
    expect(run(rect, only, {}, { x: 35, y: 12 }).point).toEqual({ x: expect.closeTo(35, 9), y: expect.closeTo(10, 9) });
  });
});

describe('ownGeometryAt', () => {
  it("is the subject's own nearest geometry point, from the shared index", () => {
    expect(ownGeometryAt(cross, { x: 3, y: 2 }, ['a'], ONE)).toEqual({ x: 0, y: 0 });
    expect(ownGeometryAt(cross, { x: 3, y: 2 }, ['zzz'], ONE)).toBeNull();
  });

  it('looks no farther from the press than the reach it is given', () => {
    // The anchor at 0,0 is 3.6 away; the line itself passes 0.7 away.
    expect(ownGeometryAt(cross, { x: 3, y: 2 }, ['a'], ONE, 3)).toEqual({ x: expect.closeTo(2.5, 9), y: expect.closeTo(2.5, 9) });
    expect(ownGeometryAt(cross, { x: 3, y: 2 }, ['a'], ONE, 0.5)).toBeNull();
  });
});

describe('createSceneSnapIndexer', () => {
  it("keeps a gesture's index with its own geometry while a query without any reads the scene's", () => {
    const index = createSceneSnapIndexer(cross);
    const also = { anchors: [{ x: 5, y: 5 }] };
    const withAlso = index(also);
    const bare = index();
    expect(bare).not.toBe(withAlso);
    expect(index(also)).toBe(withAlso);
    expect(index()).toBe(bare);
  });
});
