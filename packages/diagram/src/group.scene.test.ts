import { describe, expect, it } from 'vitest';
import {
  createScene, derivedDepOf, effectivePose, moveAction, pointAlongPath,
  type OngoingHandle, type OngoingInvoker, type RectPose,
} from '@weasel-js/core';
import { withDiagramRegistry } from './edge';
import { diagramScene, edgeIdOf, type DiagramData } from './fromData';
import { fitDiagram } from './DiagramView';

const DATA: DiagramData = {
  nodes: [{ id: 'a', lines: ['a'] }, { id: 'b', lines: ['b'] }, { id: 'x', lines: ['outside'] }],
  edges: [{ from: 'a', to: 'b' }, { from: 'x', to: 'G' }],
  groups: [{ id: 'G', members: ['a', 'b'], label: 'the group' }],
};

function load(data: DiagramData = DATA) {
  const specs = diagramScene(data);
  const scene = createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    initial: specs as never,
    registry: withDiagramRegistry(),
  });
  const pose = (id: string) => effectivePose(scene as never, scene.get(id as never)! as never) as RectPose;
  return { specs, scene, pose };
}

const contains = (outer: RectPose, inner: RectPose) =>
  inner.x >= outer.x && inner.y >= outer.y
  && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;

describe('a group in a scene', () => {
  it('draws its box around its members, behind them', () => {
    const { specs, pose } = load();
    expect(contains(pose('G'), pose('a'))).toBe(true);
    expect(contains(pose('G'), pose('b'))).toBe(true);
    expect(specs.findIndex((s) => s.id === 'G')).toBeLessThan(specs.findIndex((s) => s.id === 'a'));
  });

  it('grows to fit a label longer than its members are wide, and keeps its neighbors clear', () => {
    const data: DiagramData = {
      nodes: [{ id: 'a', lines: ['a'] }, { id: 'b', lines: ['b'] }, { id: 'c', lines: ['c'] }],
      edges: [{ from: 'c', to: 'a' }, { from: 'c', to: 'b' }],
      groups: [{ id: 'G', members: ['a'], label: 'a label much wider than its one member' }],
    };
    const { specs, pose } = load(data);
    const title = pose('G/label');
    expect(pose('G').width).toBeGreaterThanOrEqual(title.width);
    expect(contains(pose('G'), title)).toBe(true);
    const g = pose('G');
    const b = pose('b');
    expect(b.x >= g.x + g.width || b.x + b.width <= g.x).toBe(true);
    expect(specs.find((s) => s.id === 'G')!.pose).toEqual(g);
  });

  it('derives the same box the spec was built with', () => {
    const { specs, pose } = load();
    expect(pose('G')).toEqual(specs.find((s) => s.id === 'G')!.pose);
  });

  it('follows a member that moves, and carries its label along', () => {
    const { scene, pose } = load();
    const label = pose('G/label');
    const box = pose('G');
    const a = pose('a');
    scene.setPose('a' as never, { ...a, x: a.x + 500 });
    expect(contains(pose('G'), pose('a'))).toBe(true);
    expect(pose('G').width).toBeGreaterThan(box.width);
    expect(pose('G/label').x - pose('G').x).toBeCloseTo(label.x - box.x);
    expect(pose('G/label').y - pose('G').y).toBeCloseTo(label.y - box.y);
  });

  it('can be picked, so a press on the box or its title grabs the group', () => {
    const { specs } = load();
    expect(specs.find((s) => s.id === 'G')!.pickable).toBeUndefined();
    expect(specs.find((s) => s.id === 'G/label')!.pickable).toBe(false);
  });

  it('moves its members when it is dragged', () => {
    const { scene, pose } = load();
    const before = { a: pose('a'), b: pose('b'), x: pose('x'), box: pose('G') };
    const drag = { start: { x: 0, y: 0 }, current: { x: 40, y: 30 }, delta: { x: 40, y: 30 } };
    const ctx = (d?: typeof drag) => ({
      world: d ? d.current : { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: { selection: { get: () => ['G'] }, scene },
      drag: d,
    }) as never;
    const handle = (moveAction.invoker as OngoingInvoker).start(ctx(), {}) as OngoingHandle;
    handle.onMove!(ctx(drag));
    handle.onEnd!(ctx(drag), 'commit');
    expect(pose('a')).toEqual({ ...before.a, x: before.a.x + 40, y: before.a.y + 30 });
    expect(pose('b')).toEqual({ ...before.b, x: before.b.x + 40, y: before.b.y + 30 });
    expect(pose('G')).toEqual({ ...before.box, x: before.box.x + 40, y: before.box.y + 30 });
    expect(pose('x')).toEqual(before.x);
  });

  it('puts its label inside the box, above every member', () => {
    const { pose } = load();
    const label = pose('G/label');
    expect(contains(pose('G'), label)).toBe(true);
    expect(label.y + label.height).toBeLessThanOrEqual(Math.min(pose('a').y, pose('b').y));
  });

  it('ends an edge naming the group on the box, not on a member', () => {
    const { scene, pose } = load();
    const path = derivedDepOf(scene as never, edgeIdOf({ from: 'x', to: 'G' }) as never)!.path!;
    const end = pointAlongPath(path, 1)!.point;
    const g = pose('G');
    const onEdge = [g.x, g.x + g.width].some((v) => Math.abs(end.x - v) < 1e-6)
      || [g.y, g.y + g.height].some((v) => Math.abs(end.y - v) < 1e-6);
    expect(onEdge, `end ${JSON.stringify(end)} box ${JSON.stringify(g)}`).toBe(true);
  });

  it('is framed by fitDiagram', () => {
    const { specs } = load({ ...DATA, groups: [{ id: 'G', members: ['a', 'b'], padding: 3000 }] });
    const view = fitDiagram(specs, { width: 1000, height: 1000 })!;
    const g = specs.find((s) => s.id === 'G')!.pose as RectPose;
    // The box is far bigger than the nodes, so framing only the nodes would leave it cut off.
    expect((g.x - view.x) * view.scale.x).toBeGreaterThanOrEqual(-1e-6);
    expect((g.y - view.y) * view.scale.y).toBeGreaterThanOrEqual(-1e-6);
  });

  it('throws on a group id that is already a node id', () => {
    expect(() => diagramScene({ ...DATA, groups: [{ id: 'a', members: ['b'] }] })).toThrow(/already/);
  });

  it('draws nothing for a group with no real members', () => {
    const specs = diagramScene({ ...DATA, groups: [{ id: 'G', members: ['nope'] }] });
    expect(specs.some((s) => s.id === 'G')).toBe(false);
  });

  it('takes in a label on a wire between its members, and derives the box it was built with', () => {
    const wire = { from: 'a', to: 'b', label: 'a label far wider than either of its two ends' };
    const { specs, pose } = load({ ...DATA, edges: [wire, DATA.edges[1]!] });
    const label = pose(`${edgeIdOf(wire)}/label`);
    expect(contains(pose('G'), label)).toBe(true);
    expect(pose('G')).toEqual(specs.find((s) => s.id === 'G')!.pose);
  });
});

describe('a group inside a group, in a scene', () => {
  const NESTED: DiagramData = {
    nodes: [
      { id: 'a', lines: ['a'] }, { id: 'b', lines: ['b'] }, { id: 'c', lines: ['c'] },
      { id: 'x', lines: ['outside'] },
    ],
    edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'x', to: 'a' }],
    groups: [
      { id: 'Sys', members: ['Inner', 'c'], label: 'the system' },
      { id: 'Inner', members: ['a', 'b'], label: 'the part' },
    ],
  };

  it('draws the outer box around the inner box, and behind it', () => {
    const { specs, pose } = load(NESTED);
    expect(contains(pose('Inner'), pose('a'))).toBe(true);
    expect(contains(pose('Sys'), pose('Inner'))).toBe(true);
    expect(contains(pose('Sys'), pose('c'))).toBe(true);
    expect(pose('Sys').width).toBeGreaterThan(pose('Inner').width);
    expect(specs.findIndex((s) => s.id === 'Sys')).toBeLessThan(specs.findIndex((s) => s.id === 'Inner'));
    expect(specs.find((s) => s.id === 'Sys')!.dependsOn).toEqual(['Inner', 'c']);
  });

  it('derives the same boxes the specs were built with', () => {
    const { specs, pose } = load(NESTED);
    expect(pose('Sys')).toEqual(specs.find((s) => s.id === 'Sys')!.pose);
    expect(pose('Inner')).toEqual(specs.find((s) => s.id === 'Inner')!.pose);
  });

  it('keeps the outsider out of the outer box, and the outer title above the inner box', () => {
    const { pose } = load(NESTED);
    const sys = pose('Sys');
    const x = pose('x');
    const apart = x.x + x.width <= sys.x || sys.x + sys.width <= x.x
      || x.y + x.height <= sys.y || sys.y + sys.height <= x.y;
    expect(apart).toBe(true);
    const title = pose('Sys/label');
    expect(title.y + title.height).toBeLessThanOrEqual(pose('Inner').y);
  });
});
