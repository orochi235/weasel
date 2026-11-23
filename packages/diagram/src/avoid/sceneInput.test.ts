import { describe, expect, it } from 'vitest';
import { commitOps, createScene, scenePoseFrame, type ActionDeps, type NodeId, type PoseComposition, type RectPose, type Scene } from '@weasel-js/core';
import { CONTAINER_STENCILS, containerBuild } from '../containers/containerStencils';
import { EDGE_DERIVE_PATH, withDiagramRegistry } from '../edge';
import { edgeLabelSpec, endLabelIdOf } from '../edgeLabel';
import type { DiagramEdge } from '../edgeTrait';
import { avoidSceneInput } from './sceneInput';

type AvoidScene = Scene<unknown, 'main', RectPose>;

const box = (id: string, x: number, y: number, width = 100, height = 60) =>
  ({ id: id as never, kind: 'mark' as const, layer: 'main' as const, pose: { x, y, width, height }, data: { diagram: {} } });

const connector = (id: string, from: string, to: string, extra: Partial<DiagramEdge> = {}) => ({
  id: id as never, kind: 'mark' as const, layer: 'main' as const, pose: { x: 0, y: 0, width: 0, height: 0 },
  data: { diagram: { from: {}, to: {}, router: 'avoid', ...extra } },
  dependsOn: [from as never, to as never],
  derivePath: EDGE_DERIVE_PATH,
});

const sceneOf = (initial: unknown[]): AvoidScene =>
  createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry(), initial: initial as never });

describe('avoidSceneInput', () => {
  it('reads every label of a connector, its end labels with its middle one', () => {
    const scene = sceneOf([
      box('a', 0, 0), box('b', 400, 0), connector('ab', 'a', 'b'),
      edgeLabelSpec('ab', 'note', { layer: 'main' }),
      edgeLabelSpec('ab', '1..*', { layer: 'main', id: endLabelIdOf('ab', 'from'), label: { at: 'start', offset: 4 } }),
    ]);
    const [edge] = avoidSceneInput(scene).edges;
    expect(edge!.labels?.map((l) => l.id)).toEqual(['ab/label', endLabelIdOf('ab', 'from')]);
  });

  /** A scene holding a container at (300, 200), shape `in` inside it at world (340, 260), and `out` at (0, 0). */
  function nested() {
    const scene = sceneOf([box('out', 0, 0)]);
    const built = containerBuild(CONTAINER_STENCILS.find((s) => s.id === 'container')!, { x: 300, y: 200, width: 240, height: 160 }, {
      layer: 'main', newId: () => 'box', composition: scene.composition as PoseComposition<RectPose>,
    });
    commitOps({ scene } as unknown as ActionDeps, built.ops, 'Insert');
    const local = scenePoseFrame(scene as never).localUnder('box' as NodeId, { x: 340, y: 260, width: 100, height: 60 }) as RectPose;
    scene.add({ ...box('in', local.x, local.y), parent: 'box' as NodeId } as never);
    return scene;
  }
  const boxOf = (scene: AvoidScene, id: string, frame: Map<string, RectPose>) =>
    avoidSceneInput(scene, {}, frame).obstacles.find((o) => o.id === id)!.box;

  it('reads a drag frame’s pose for a nested shape in its parent’s frame, as stored', () => {
    const scene = nested();
    const stored = scene.get('in' as never)!.pose as RectPose;
    const box = boxOf(scene, 'in', new Map([['in', { ...stored, y: stored.y + 50 }]]));
    expect(box).toMatchObject({ x: 340, y: 310 });
  });

  it('moves what a dragged container holds with it', () => {
    const scene = nested();
    const stored = scene.get('box' as never)!.pose as RectPose;
    const box = boxOf(scene, 'in', new Map([['box', { ...stored, x: stored.x + 100 }]]));
    expect(box).toMatchObject({ x: 440, y: 260 });
  });
});
