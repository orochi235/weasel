import { describe, expect, it } from 'vitest';
import { createScene, type RectPose, type Scene } from '@weasel-js/core';
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
});
