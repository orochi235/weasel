import { describe, it, expect } from 'vitest';
import { pathFromD } from '@weasel-js/geom';
import { INHERIT } from '@weasel-js/paint';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose } from 'core/scene/types';
import { nodeShapesOf } from 'canvas/nodeShapeRegistry';
import type { EffectItem } from 'core/scene/pathEffects/source';
import { readEffectSource } from './readSource';

const BOX = { x: 0, y: 0, width: 100, height: 20 };
const RED = { paint: { kind: 'solid', color: '#f00' } } as const;
const BLUE = { color: '#00f', width: 2 } as const;
const BAR = pathFromD('M0 0 L1 0 L1 1 Z');

describe('readEffectSource', () => {
  it("lays a source's items in the paint it inherits", () => {
    const scene = createScene<unknown, 'main', RectPose>({
      systemLayers: [{ id: 'main' }],
      initial: [{ id: asNodeId('t'), kind: 'mark', layer: 'main', pose: BOX, data: { beads: 1, fill: INHERIT, stroke: INHERIT } }],
    });
    nodeShapesOf(scene).register({
      id: 'test:beads',
      matches: (n) => typeof n.data === 'object' && n.data !== null && 'beads' in n.data,
      paint: () => [],
      effectItems: (n): EffectItem[] => {
        const d = n.data as { fill: never; stroke: never };
        return [{ length: 1, middle: 0, parts: [{ path: BAR, fill: d.fill, stroke: d.stroke }] }];
      },
    });
    const t = scene.get(asNodeId('t'))!;
    const inherited = { fill: RED, stroke: BLUE };
    const source = readEffectSource({ node: t, pose: t.pose, path: BAR, scene, inherited } as never);
    expect(source?.items?.()[0]!.parts[0]).toMatchObject({ fill: RED, stroke: BLUE });
  });
});
