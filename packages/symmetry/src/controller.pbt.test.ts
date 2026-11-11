/**
 * Stateful and property tests of live symmetry: the controller's updates, drags, undo, and redo against a model of
 * its history, the contents staying where they drew; a handle dragged away and back leaving the group as it was; and
 * the handles and their changes moving with the center.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { boxFrameOf, type Point } from '@weasel-js/geom';
import {
  asNodeId, createScene, type InvocationCtx, type NodeId, type OngoingInvoker, type RectPose, type SceneRegistry, type View,
} from '@weasel-js/core';
import { createSymmetry } from './controller';
import { worldPoseOf } from './frames';
import { symmetryRegistry } from './group';
import { guideHandles, symmetryGuideLayer, type SymmetryHandle } from './guide';
import { handleChange, handleDragAction } from './handleDrag';
import { symmetryTransforms, type SymmetrySpec } from './kinds';
import { lookup, maxDiff, near, point, runs, spec, tally, timeoutFor } from './pbt.fixture';

const RUNS = 120;

/** A point on an eighth-unit grid, so a center moved into a frame and back is the same number. */
const exact = (limit = 1000) => fc.record({ x: fc.integer({ min: -8 * limit, max: 8 * limit }), y: fc.integer({ min: -8 * limit, max: 8 * limit }) })
  .map(({ x, y }) => ({ x: x / 8, y: y / 8 }));
const KEYS = ['kind', 'angle', 'count', 'spacing', 'glide', 'glideRows', 'cell', 'cellAngle', 'rowAngle', 'rowSpacing', 'extent'] as const;

/** Some of a spec's fields. */
const partial = fc.tuple(spec(), fc.subarray([...KEYS], { minLength: 1 }))
  .map(([s, keys]) => Object.fromEntries(keys.map((k) => [k, s[k]])) as Partial<SymmetrySpec>);

type Op =
  | { op: 'spec'; spec: Partial<SymmetrySpec> }
  | { op: 'center'; center: Point }
  | { op: 'both'; spec: Partial<SymmetrySpec>; center: Point }
  | { op: 'same'; keys: (typeof KEYS)[number][]; center: boolean }
  | { op: 'drag'; frames: { spec?: Partial<SymmetrySpec>; center?: Point }[]; end: { spec?: Partial<SymmetrySpec>; center?: Point } | null }
  | { op: 'undo' }
  | { op: 'redo' };

const op: fc.Arbitrary<Op> = fc.oneof(
  { weight: 3, arbitrary: partial.map((s) => ({ op: 'spec' as const, spec: s })) },
  { weight: 3, arbitrary: exact(500).map((c) => ({ op: 'center' as const, center: c })) },
  { weight: 1, arbitrary: fc.tuple(partial, exact(500)).map(([s, c]) => ({ op: 'both' as const, spec: s, center: c })) },
  { weight: 2, arbitrary: fc.record({ keys: fc.subarray([...KEYS]), center: fc.boolean() }).map((r) => ({ op: 'same' as const, ...r })) },
  {
    weight: 2,
    arbitrary: fc.record({
      frames: fc.array(fc.record({ spec: fc.option(partial, { nil: undefined }), center: fc.option(exact(500), { nil: undefined }) }, { requiredKeys: [] }), { maxLength: 4 }),
      end: fc.option(fc.record({ spec: fc.option(partial, { nil: undefined }), center: fc.option(exact(500), { nil: undefined }) }, { requiredKeys: [] }), { nil: null }),
    }).map((r) => ({ op: 'drag' as const, ...r })),
  },
  { weight: 3, arbitrary: fc.constant({ op: 'undo' as const }) },
  { weight: 3, arbitrary: fc.constant({ op: 'redo' as const }) },
);

const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

function rig(host: Point | null, s: SymmetrySpec, center: Point) {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: symmetryRegistry as SceneRegistry<RectPose> });
  const sym = createSymmetry(scene as never);
  const parent = host === null ? null : scene.add({ kind: 'group', layer: 'main', pose: { x: host.x, y: host.y, width: 0, height: 0 }, data: {} });
  const group = sym.create({ center, symmetry: s, parent });
  const leaf = scene.add({ kind: 'mark', layer: 'main', parent: group, id: asNodeId('leaf'), pose: { x: 20, y: 10, width: 10, height: 10 }, data: {} });
  return { scene, sym, group, leaf };
}

interface State { spec: SymmetrySpec; center: Point }

describe('the controller, against a model of its history', () => {
  it('reads what each update wrote, records one step per change and none for a change to nothing, and undoes and redoes exactly', () => {
    const t = tally();
    fc.assert(fc.property(fc.option(exact(300), { nil: null }), spec(), exact(300), fc.array(op, { maxLength: 14 }), (host, s0, c0, ops) => {
      const { scene, sym, group, leaf } = rig(host, s0, c0);
      const leafAt = boxFrameOf(worldPoseOf(scene as never, leaf))!;
      const read = (): State => sym.read(group)!;
      const done: State[] = [read()];
      let redo: State[] = [];
      const base = scene.historyIndex();
      const write = (change: { spec?: Partial<SymmetrySpec>; center?: Point }, apply: () => void): void => {
        const cur = done[done.length - 1]!;
        const next: State = { spec: { ...cur.spec, ...change.spec }, center: change.center ?? cur.center };
        const changes = JSON.stringify(next.spec) !== JSON.stringify(cur.spec) || maxDiff([next.center.x, next.center.y], [cur.center.x, cur.center.y]) > 0;
        apply();
        if (!changes) {
          t.count('no change');
          expect(scene.historyIndex()).toBe(base + done.length - 1);
          return;
        }
        t.count('change');
        done.push(read());
        redo = [];
        expect(read().spec).toEqual(next.spec);
        expect(near([1, 0, 0, 1, read().center.x, read().center.y], [1, 0, 0, 1, next.center.x, next.center.y], 1e-12)).toBe(true);
      };
      for (const o of ops) {
        switch (o.op) {
          case 'spec': write({ spec: o.spec }, () => sym.update(group, { spec: o.spec })); break;
          case 'center': write({ center: o.center }, () => sym.update(group, { center: o.center })); break;
          case 'both': write({ spec: o.spec, center: o.center }, () => sym.update(group, { spec: o.spec, center: o.center })); break;
          case 'same': {
            const cur = read();
            const change = clean({
              spec: Object.fromEntries(o.keys.map((k) => [k, cur.spec[k]])) as Partial<SymmetrySpec>,
              center: o.center ? { ...cur.center } : undefined,
            });
            const at = scene.historyIndex();
            sym.update(group, change);
            t.count('same');
            expect(scene.historyIndex()).toBe(at);
            expect(read()).toEqual(cur);
            break;
          }
          case 'drag': {
            const origin = read();
            const end = o.end && clean(o.end);
            write(end ?? {}, () => {
              for (const f of o.frames) sym.preview(group, clean(f));
              sym.preview(group, origin);
              if (end) sym.update(group, end, 'Move symmetry guide');
            });
            break;
          }
          case 'undo': {
            // The group's creation is a step too, under the model's first state.
            if (done.length > 1) {
              expect(scene.undo()).toBe(true);
              redo.push(done.pop()!);
              t.count('undo');
            }
            expect(read()).toEqual(done[done.length - 1]);
            break;
          }
          case 'redo': {
            const could = redo.length > 0;
            expect(scene.redo()).toBe(could);
            if (could) {
              done.push(redo.pop()!);
              t.count('redo');
            }
            expect(read()).toEqual(done[done.length - 1]);
            break;
          }
        }
        expect(scene.historyIndex()).toBe(base + done.length - 1);
        expect(near(boxFrameOf(worldPoseOf(scene as never, leaf))!, leafAt, 1e-9)).toBe(true);
      }
    }), runs(RUNS));
    for (const k of ['change', 'same', 'undo']) t.atLeast(k, 40);
    t.atLeast('no change', 8);
    t.atLeast('redo', 5);
  }, timeoutFor(RUNS, 30));
});

const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } } as View;
const KNOB = 64;

/** The world point a press on `handle` lands at, with the default guide style and an identity view. */
function handleAt(s: SymmetrySpec, c: Point, handle: SymmetryHandle): Point | null {
  return guideHandles(s, c, VIEW, KNOB, 0, 9).find((h) => h.handle === handle)?.at ?? null;
}

function drag(sym: ReturnType<typeof rig>['sym'], group: NodeId, handle: SymmetryHandle, from: Point, path: Point[]): void {
  const ctx = (p: Point) => ({
    world: p, screen: p, modifiers: { alt: false, ctrl: false, meta: false, shift: false }, deps: {},
    drag: { start: from, current: p, delta: { x: p.x - from.x, y: p.y - from.y }, affordance: { payload: { handle, group } } },
  }) as unknown as InvocationCtx;
  const h = (handleDragAction(sym).invoker as OngoingInvoker).start(ctx(from), undefined);
  for (const p of path) h.onMove!(ctx(p));
  h.onEnd!(ctx(path[path.length - 1] ?? from), 'commit');
}

describe('a handle drag', () => {
  const handles: SymmetryHandle[] = ['center', 'angle', 'step', 'row'];
  const KINDS_WITH: Record<SymmetryHandle, readonly SymmetrySpec['kind'][]> = {
    center: ['mirror', 'point', 'radial', 'repeat', 'wallpaper'], angle: ['mirror', 'both', 'kaleidoscope'], step: ['repeat', 'wallpaper'], row: ['wallpaper'],
  };
  const pressed = (hs: readonly SymmetryHandle[]) => fc.constantFrom(...hs).chain((handle) => spec({ kinds: KINDS_WITH[handle] }).map((s) => ({ handle, s })));

  it('dragged away and back to where it was pressed leaves the group as it was, and records nothing', () => {
    const t = tally();
    fc.assert(fc.property(pressed(handles), point(300), fc.array(point(600), { maxLength: 4 }), ({ handle, s }, c, away) => {
      const { scene, sym, group } = rig(null, s, c);
      const from = handleAt(s, c, handle);
      if (!from) return;
      t.count(handle);
      const before = sym.read(group)!;
      const at = scene.historyIndex();
      drag(sym, group, handle, from, [...away, from]);
      expect(sym.read(group)).toEqual(before);
      expect(scene.historyIndex()).toBe(at);
    }), runs(RUNS));
    for (const h of handles) t.atLeast(h, 15);
  }, timeoutFor(RUNS, 10));

  it('dragged back onto its own handle from anywhere along its line draws the same copies', () => {
    const t = tally();
    fc.assert(fc.property(pressed(['angle', 'step', 'row']), point(300), fc.double({ min: 1.5, max: 20, noNaN: true }), ({ handle, s }, c, k) => {
      const { sym, group } = rig(null, s, c);
      const at = handleAt(s, c, handle);
      if (!at) return;
      t.count(handle);
      const before = symmetryTransforms(sym.read(group)!.spec, c);
      // Pressed farther out along the handle's own line, as a press within the hit radius may be, then dropped on it.
      const from = { x: c.x + (at.x - c.x) * (handle === 'angle' ? k : 1), y: c.y + (at.y - c.y) * (handle === 'angle' ? k : 1) };
      drag(sym, group, handle, from, [{ x: from.x + 40, y: from.y - 25 }, at]);
      const after = symmetryTransforms(sym.read(group)!.spec, c);
      expect(after).toHaveLength(before.length);
      // A step handle pressed on a negative spacing comes back as the opposite direction, which steps the same places in another order.
      const has = lookup(before, 25, c);
      for (const m of after) expect(has(m, 1e-6)).toBe(true);
    }), runs(RUNS));
    for (const h of ['angle', 'step', 'row']) t.atLeast(h, 15);
  }, timeoutFor(RUNS, 10));

  it('moves with the center: the same drag about a moved center makes the same change, moved', () => {
    const identity = { point: (p: Point) => p, angle: (a: number) => a };
    fc.assert(fc.property(spec(), exact(), fc.constantFrom(...handles), exact(), exact(), exact(), (s, c, handle, from, to, v) => {
      const plus = (p: Point) => ({ x: p.x + v.x, y: p.y + v.y });
      const a = handleChange({ handle, group: 'g' }, { center: c, spec: s }, from, to, identity);
      const b = handleChange({ handle, group: 'g' }, { center: plus(c), spec: s }, plus(from), plus(to), identity);
      if (a.center) expect(maxDiff([b.center!.x, b.center!.y], [a.center.x + v.x, a.center.y + v.y])).toBeLessThan(1e-9);
      for (const [k, x] of Object.entries(a.spec ?? {})) {
        const y = (b.spec as Record<string, number>)[k]!;
        expect(Math.abs(Math.cos(x as number) - Math.cos(y)) + Math.abs(Math.sin(x as number) - Math.sin(y)) < 1e-6 || Math.abs((x as number) - y) < 1e-6 * Math.max(1, Math.abs(y))).toBe(true);
      }
    }), runs(RUNS));
  });
});

describe('the guide', () => {
  const view = fc.record({
    x: fc.double({ min: -500, max: 500, noNaN: true }), y: fc.double({ min: -500, max: 500, noNaN: true }),
    k: fc.double({ min: 0.1, max: 8, noNaN: true }), flipY: fc.boolean(),
  }).map(({ x, y, k, flipY }) => ({ x, y, scale: { x: k, y: flipY ? -k : k } }) as View);

  it('moves its handles with the center, by the move on screen', () => {
    fc.assert(fc.property(spec(), point(), point(), view, fc.double({ min: 0, max: 400, noNaN: true }), (s, c, v, vw, reach) => {
      const a = guideHandles(s, c, vw, KNOB, reach, 9);
      const b = guideHandles(s, { x: c.x + v.x, y: c.y + v.y }, vw, KNOB, reach, 9);
      expect(b.map((h) => h.handle)).toEqual(a.map((h) => h.handle));
      a.forEach((h, i) => {
        const [sx, sy] = [vw.scale.x * v.x, vw.scale.y * v.y];
        expect(maxDiff([b[i]!.at.x, b[i]!.at.y], [h.at.x + sx, h.at.y + sy])).toBeLessThan(1e-6);
      });
    }), runs(RUNS));
  });

  it('takes a press on each handle as a handle within its hit radius, and draws nothing that is not finite', () => {
    const t = tally();
    fc.assert(fc.property(spec(), point(), view, (s, c, vw) => {
      const layer = symmetryGuideLayer({ current: () => ({ group: 'g', spec: s, center: c }), subscribe: () => () => {} });
      for (const h of guideHandles(s, c, vw, KNOB, 0, 9)) {
        const wx = h.at.x / vw.scale.x + vw.x;
        const wy = h.at.y / vw.scale.y + vw.y;
        const hit = layer.hitTest!(wx, wy, undefined, vw, { width: 800, height: 600 } as never);
        expect(hit).not.toBeNull();
        const got = (hit!.initialScratch as { handle: SymmetryHandle }).handle;
        const there = guideHandles(s, c, vw, KNOB, 0, 9).find((g) => g.handle === got)!;
        expect(Math.hypot(there.at.x - h.at.x, there.at.y - h.at.y)).toBeLessThanOrEqual(9 + 1e-9);
        t.count(h.handle);
      }
      const drawn = JSON.stringify(layer.draw(undefined, vw, { width: 800, height: 600 } as never));
      expect(drawn).not.toMatch(/null|NaN|Infinity/);
    }), runs(RUNS));
    for (const h of ['center', 'angle', 'step', 'row']) t.atLeast(h, 15);
  }, timeoutFor(RUNS, 10));
});
