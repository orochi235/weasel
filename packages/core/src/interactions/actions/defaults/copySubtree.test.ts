import { describe, it, expect } from 'vitest';
import { copySelection } from './copySubtree';
import { createScene } from 'core/scene/scene';
import type { Node, RectPose } from 'core/scene/types';

type N = Node<{ label: string }, 'main', RectPose>;
const POSE: RectPose = { x: 0, y: 0, width: 10, height: 10 };

function makeScene() {
  const scene = createScene<{ label: string }, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const leaf = (label: string, extra: object = {}) =>
    scene.add({ kind: 'mark', layer: 'main', pose: POSE, data: { label }, ...extra });
  const a = leaf('a');
  const b = leaf('b');
  const edge = leaf('edge', { dependsOn: [a, b], derivePath: () => null });
  return { scene, a, b, edge };
}

function copy(scene: ReturnType<typeof makeScene>['scene'], ids: string[]) {
  const { ops } = copySelection(scene as never, ids, (_id, node) => node.pose, 'Copy');
  const nodes = ops.map((o) => (o.args as { node: N }).node);
  return new Map(nodes.map((n) => [n.data.label, n]));
}

describe('copySelection and a derived node', () => {
  it('points a copied edge at the copies of what it depends on', () => {
    const { scene, a, b, edge } = makeScene();
    const copies = copy(scene, [edge, a, b]);
    expect(copies.get('edge')!.dependsOn).toEqual([copies.get('a')!.id, copies.get('b')!.id]);
    expect(scene.get(edge)!.dependsOn).toEqual([a, b]);
  });

  it('points at the copy of each dependency copied with it, and at the original of the rest', () => {
    const { scene, a, b, edge } = makeScene();
    const copies = copy(scene, [edge, a]);
    expect(copies.get('edge')!.dependsOn).toEqual([copies.get('a')!.id, b]);
  });

  it('keeps following the originals when none of them was copied', () => {
    const { scene, a, b, edge } = makeScene();
    const copies = copy(scene, [edge]);
    expect(copies.get('edge')!.dependsOn).toEqual([a, b]);
  });
});
