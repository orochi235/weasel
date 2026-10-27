import { useMemo } from 'react';
import { asNodeId, RIGID_POSE_COMPOSITION, SceneCanvas, useScene, type RectPose, type UnitScope } from '@weasel-js/core';
import { createGridLayer, gridSnapSource, sceneGridRegions, type GridScopes } from '@weasel-js/guides';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { DemoStage } from './DemoStage';

interface Data { color: string | null }

const W = 480, H = 320;
const ROOT: UnitScope = { system: { base: 'px', units: { px: 1 } } };
/** A millimeter is 4 px here. */
const MM: UnitScope = { system: { base: 'mm', units: { mm: 1 } }, scale: 4 };
/** 20 px outside, 2 mm inside a millimeter scope. */
const SCOPES: GridScopes = { root: ROOT, spacing: (scope) => (scope.system.base === 'mm' ? 2 : 20) };

const box = (x: number, y: number, width: number, height: number, rotation = 0): RectPose => ({ x, y, width, height, rotation });
/** The sub-assembly is turned 20°; its children are placed in its frame. */
const NODES = [
  { id: asNodeId('assembly'), kind: 'group' as const, layer: 'default' as const, parent: null, units: MM, pose: box(210, 70, 200, 180, Math.PI / 9), data: { color: null } },
  { id: asNodeId('inside'), kind: 'mark' as const, layer: 'default' as const, parent: asNodeId('assembly'), pose: box(40, 40, 48, 32), data: { color: '#7fb069' } },
  { id: asNodeId('outside'), kind: 'mark' as const, layer: 'default' as const, parent: null, pose: box(60, 120, 60, 40), data: { color: '#e0a458' } },
];

export function ScopedGridDemo() {
  const scene = useScene<Data, 'default', RectPose>({
    systemLayers: [{ id: 'default' }], initial: NODES, composition: RIGID_POSE_COMPOSITION,
  });
  const grid = useMemo(() => createGridLayer({
    spacing: 20,
    scopes: SCOPES,
    accentEvery: 5,
    regions: () => sceneGridRegions(scene, ROOT),
  }), [scene]);
  const snap = useMemo(() => ({ sources: [gridSnapSource({ spacing: 20, scopes: SCOPES })] }), []);

  return (
    <DemoStage width={W} height={H}>
      <SceneCanvas
        features={['select', 'move', 'view']}
        className="ckd-canvas"
        scene={scene}
        snap={snap}
        layers={{
          grid: { layer: grid },
          scene: {
            drawOne: (node, p): DrawCommand[] => [{
              kind: 'path',
              path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
              ...(node.data.color
                ? { fill: { paint: { color: node.data.color } } }
                : { stroke: { paint: { color: '#8aa0c0' }, width: 1 } }),
            }],
          },
        }}
      />
    </DemoStage>
  );
}
