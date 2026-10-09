import { describe, expect, it } from 'vitest';
import { createScene, derivedDepOf, effectivePose, pointAlongPath, type RectPose } from '@weasel-js/core';
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
});
