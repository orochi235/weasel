/**
 * A group's box and anything anchored to a node. `boxAround` holds the union and its inset and widens evenly to its
 * minimum; `groupDerivePose` is that box around whichever members are there, moved whole with them; an anchored
 * node's `self` point lands on the `at` point of what it is anchored to. Then a scene built from random groups,
 * nested, through moves and resizes of its nodes, undos, and redos: every group's box stands around what it depends
 * on, every title on its group, and undo puts every node back exactly.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createScene, effectivePose, type RectPose, type Scene } from '@weasel-js/core';
import { boxAround, diagramAnchorOf, diagramGroupOf, groupDerivePose, anchorDerivePose } from './group';
import { insetOf } from './cluster';
import { withDiagramRegistry } from './edge';
import { diagramScene, type DiagramData } from './fromData';
import { grownBy } from './footprint';
import { coord, gridCoord, nonFinite, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;

type Rect = { x: number; y: number; width: number; height: number };
const size = fc.integer({ min: 0, max: 200 });
const rect = (c: fc.Arbitrary<number> = coord): fc.Arbitrary<Rect> => fc.record({ x: c, y: c, width: size, height: size });
const insetArb = fc.oneof(
  fc.constant(undefined),
  fc.integer({ min: 0, max: 40 }),
  fc.record({ top: fc.integer({ min: 0, max: 40 }), right: fc.integer({ min: 0, max: 40 }), bottom: fc.integer({ min: 0, max: 40 }), left: fc.integer({ min: 0, max: 40 }) }, { requiredKeys: [] }),
);
const groupArb = fc.record({ inset: insetArb, minWidth: fc.option(fc.integer({ min: 0, max: 400 }), { nil: undefined }) })
  .map(({ inset, minWidth }) => ({ ...(inset !== undefined ? { inset } : {}), ...(minWidth !== undefined ? { minWidth } : {}) }));
const anchor = fc.record({ u: fc.constantFrom(0, 0.5, 1), v: fc.constantFrom(0, 0.5, 1) });

const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

describe('boxAround', () => {
  it('holds the union grown by the inset, and widens evenly to its minimum', () => {
    const seen = tally();
    fc.assert(fc.property(rect(), groupArb, (u, group) => {
      const box = boxAround(u, group);
      const inset = insetOf(group.inset);
      const width = u.width + inset.left + inset.right;
      expect(box.width).toBe(Math.max(width, group.minWidth ?? 0));
      if (box.width > width) seen.count('widened');
      expect(box.height).toBe(u.height + inset.top + inset.bottom);
      expect(box.y).toBe(u.y - inset.top);
      expect(near(box.x + box.width / 2, u.x - inset.left + width / 2)).toBe(true);
      expect(box.x).toBeLessThanOrEqual(u.x - inset.left);
      expect(box.x + box.width).toBeGreaterThanOrEqual(u.x + u.width + inset.right - 1e-9 * Math.max(1, Math.abs(u.x)));
    }), runs(RUNS));
    seen.atLeast('widened', RUNS / 10);
  }, timeoutFor(RUNS, 1));
});

const member = (pose: Rect, margin?: { top: number; right: number; bottom: number; left: number }) =>
  ({ node: { data: { diagram: margin ? { margin } : {} } }, pose });
const marginArb = fc.option(fc.record({ top: fc.nat(20), right: fc.nat(20), bottom: fc.nat(20), left: fc.nat(20) }), { nil: undefined });

describe('groupDerivePose', () => {
  const derive = groupDerivePose<Rect>();

  it('draws the box around the members there are, and moves it whole with them', () => {
    const seen = tally();
    fc.assert(fc.property(
      groupArb, fc.array(fc.option(fc.tuple(rect(gridCoord), marginArb), { freq: 4 }), { maxLength: 5 }), gridCoord, gridCoord,
      (group, deps, dx, dy) => {
        const node = { pose: { x: 1, y: 2, width: 3, height: 4 }, data: { diagram: { group } } };
        const live = deps.map((d) => (d === null ? undefined : member(d[0], d[1])));
        const box = derive(node, live as never);
        const there = deps.filter((d) => d !== null);
        if (there.length === 0) {
          seen.count('empty');
          expect(box).toBeNull();
          return;
        }
        seen.count('boxed');
        const grown = there.map(([p, m]) => grownBy(p, m));
        const x0 = Math.min(...grown.map((b) => b.x));
        const y0 = Math.min(...grown.map((b) => b.y));
        const union = { x: x0, y: y0, width: Math.max(...grown.map((b) => b.x + b.width)) - x0, height: Math.max(...grown.map((b) => b.y + b.height)) - y0 };
        expect(box).toEqual(boxAround(union, group));
        const moved = derive(node, live.map((d) => (d === undefined ? d : { ...d, pose: { ...d.pose, x: d.pose.x + dx, y: d.pose.y + dy } })) as never)!;
        expect(moved).toEqual({ ...box!, x: box!.x + dx, y: box!.y + dy });
      },
    ), runs(RUNS));
    seen.atLeast('empty', RUNS / 20);
    seen.atLeast('boxed', RUNS / 2);
  }, timeoutFor(RUNS, 1));

  it('stands aside for a node that is not a group', () => {
    fc.assert(fc.property(fc.anything(), (data) => {
      fc.pre(diagramGroupOf({ data }) === null);
      expect(derive({ pose: { x: 0, y: 0, width: 0, height: 0 }, data }, [member({ x: 0, y: 0, width: 1, height: 1 })] as never)).toBeNull();
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});

describe('anchorDerivePose', () => {
  const derive = anchorDerivePose<Rect>();
  it('puts the node\'s self point on its target\'s at point, and follows the target', () => {
    fc.assert(fc.property(
      rect(), rect(), anchor, fc.option(anchor, { nil: undefined }), fc.option(fc.record({ x: gridCoord, y: gridCoord }), { nil: undefined }), gridCoord, gridCoord,
      (target, own, at, self, offset, dx, dy) => {
        const node = { pose: own, data: { diagram: { anchor: { at, ...(self ? { self } : {}), ...(offset ? { offset } : {}) } } } };
        const pose = derive(node, [{ node: { data: {} }, pose: target }] as never)!;
        expect(nonFinite(pose)).toEqual([]);
        expect(pose.width).toBe(own.width);
        expect(pose.height).toBe(own.height);
        const s = self ?? at;
        expect(near(pose.x + s.u * own.width, target.x + at.u * target.width + (offset?.x ?? 0))).toBe(true);
        expect(near(pose.y + s.v * own.height, target.y + at.v * target.height + (offset?.y ?? 0))).toBe(true);
        const moved = derive(node, [{ node: { data: {} }, pose: { ...target, x: target.x + dx, y: target.y + dy } }] as never)!;
        expect(near(moved.x, pose.x + dx) && near(moved.y, pose.y + dy)).toBe(true);
        expect(derive(node, [undefined])).toBeNull();
      },
    ), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});

// --- a scene of nested groups, edited ---

const NODES = ['a', 'b', 'c', 'd', 'e'];
const GROUPS = ['G', 'H', 'I'];

const dataArb: fc.Arbitrary<DiagramData> = fc.record({
  at: fc.tuple(...NODES.map(() => fc.record({ x: gridCoord, y: gridCoord }))),
  groups: fc.tuple(...GROUPS.map(() => fc.subarray([...NODES, ...GROUPS], { maxLength: 4 }))),
  labels: fc.tuple(...GROUPS.map(() => fc.option(fc.constantFrom('G', 'a title'), { nil: undefined }))),
}).map(({ at, groups, labels }) => ({
  nodes: NODES.map((id, i) => ({ id, lines: [id], at: at[i]! })),
  edges: [],
  groups: GROUPS.map((id, i) => ({ id, members: groups[i]!, ...(labels[i] !== undefined ? { label: labels[i] } : {}) })),
}));

type AnyScene = Scene<unknown, 'main', RectPose>;
type Model = { stack: Map<string, RectPose>[]; at: number };

const authored = (scene: AnyScene) => new Map([...scene.renderOrderNodes()].map((n) => [n.id as string, { ...n.pose }]));

function check(scene: AnyScene, model: Model): void {
  expect(authored(scene)).toEqual(model.stack[model.at]);
  const pose = (id: string) => effectivePose(scene as never, scene.get(id as never)! as never) as RectPose;
  for (const n of scene.renderOrderNodes()) {
    const group = diagramGroupOf(n);
    if (group !== null) {
      const deps = (n.dependsOn as readonly string[]).filter((id) => scene.get(id as never) !== undefined);
      if (deps.length === 0) continue;
      const grown = deps.map((id) => grownBy(pose(id), (scene.get(id as never)!.data as { diagram?: { margin?: never } }).diagram?.margin));
      const x0 = Math.min(...grown.map((b) => b.x));
      const y0 = Math.min(...grown.map((b) => b.y));
      const union = { x: x0, y: y0, width: Math.max(...grown.map((b) => b.x + b.width)) - x0, height: Math.max(...grown.map((b) => b.y + b.height)) - y0 };
      const box = boxAround(union, group);
      const got = pose(n.id);
      for (const k of ['x', 'y', 'width', 'height'] as const) expect(near(got[k], box[k])).toBe(true);
    }
    const anchored = diagramAnchorOf(n);
    if (anchored !== null && Array.isArray(n.dependsOn)) {
      const target = pose(n.dependsOn[0] as string);
      const own = pose(n.id);
      const self = anchored.self ?? anchored.at;
      expect(near(own.x + self.u * own.width, target.x + anchored.at.u * target.width + (anchored.offset?.x ?? 0))).toBe(true);
      expect(near(own.y + self.v * own.height, target.y + anchored.at.v * target.height + (anchored.offset?.y ?? 0))).toBe(true);
    }
  }
}

type Cmd = fc.Command<Model, { scene: AnyScene }>;

const record = (model: Model, scene: AnyScene) => {
  model.stack.length = model.at + 1;
  model.stack.push(authored(scene));
  model.at++;
};

class Move implements Cmd {
  constructor(readonly id: string, readonly dx: number, readonly dy: number, readonly dw: number) {}
  check = () => true;
  run(model: Model, { scene }: { scene: AnyScene }): void {
    const was = scene.get(this.id as never)!.pose;
    const next = { ...was, x: was.x + this.dx, y: was.y + this.dy, width: Math.max(0, was.width + this.dw) };
    const before = scene.historyIndex();
    scene.setPose(this.id as never, next);
    const changed = next.x !== was.x || next.y !== was.y || next.width !== was.width;
    expect(scene.historyIndex()).toBe(changed ? before + 1 : before);
    if (changed) record(model, scene);
    check(scene, model);
  }
  toString = () => `move ${this.id} by ${this.dx},${this.dy} w${this.dw}`;
}

class Undo implements Cmd {
  check = (m: Readonly<Model>) => m.at > 0;
  run(model: Model, { scene }: { scene: AnyScene }): void {
    expect(scene.undo()).toBe(true);
    model.at--;
    check(scene, model);
  }
  toString = () => 'undo';
}

class Redo implements Cmd {
  check = (m: Readonly<Model>) => m.at < m.stack.length - 1;
  run(model: Model, { scene }: { scene: AnyScene }): void {
    expect(scene.redo()).toBe(true);
    model.at++;
    check(scene, model);
  }
  toString = () => 'redo';
}

const step = fc.integer({ min: -3, max: 3 }).map((n) => n * 10);
const commands = [
  fc.tuple(fc.constantFrom(...NODES), step, step, fc.constantFrom(0, 0, -20, 30)).map(([id, dx, dy, dw]) => new Move(id, dx, dy, dw)),
  fc.constant(new Undo()),
  fc.constant(new Redo()),
];

describe('a scene of nested groups', () => {
  const SCENE_RUNS = 60;
  it('keeps every box around its members and every title on its box through moves, undos, and redos', () => {
    const seen = tally();
    fc.assert(fc.property(dataArb, fc.commands(commands, { maxCommands: 25 }), (data, cmds) => {
      const scene = createScene<unknown, 'main', RectPose>({
        systemLayers: [{ id: 'main' }], initial: diagramScene(data, { layout: 'none' }) as never, registry: withDiagramRegistry(),
      }) as AnyScene;
      const nodes = [...scene.renderOrderNodes()];
      if (nodes.some((n) => diagramGroupOf(n) !== null && (n.dependsOn as readonly string[]).some((d) => GROUPS.includes(d as string)))) seen.count('nested');
      if (nodes.some((n) => diagramAnchorOf(n) !== null)) seen.count('titled');
      const model: Model = { stack: [authored(scene)], at: 0 };
      check(scene, model);
      fc.modelRun(() => ({ model, real: { scene } }), cmds);
      if (model.at > 0 && model.stack.length > 2) seen.count('edited');
    }), runs(SCENE_RUNS));
    seen.atLeast('nested', SCENE_RUNS / 5);
    seen.atLeast('titled', SCENE_RUNS / 2);
    seen.atLeast('edited', SCENE_RUNS / 3);
  }, timeoutFor(SCENE_RUNS, 60));
});
