import { useMemo } from 'react';
import { asNodeId, SceneCanvas, useScene, type Bounds, type UnitScope } from '@weasel-js/core';
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

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });
const NODES = [
  { id: asNodeId('assembly'), kind: 'group' as const, layer: 'default' as const, parent: null, units: MM, pose: box(200, 60, 200, 180), data: { color: null } },
  { id: asNodeId('inside'), kind: 'mark' as const, layer: 'default' as const, parent: asNodeId('assembly'), pose: box(240, 100, 48, 32), data: { color: '#7fb069' } },
  { id: asNodeId('outside'), kind: 'mark' as const, layer: 'default' as const, parent: null, pose: box(60, 120, 60, 40), data: { color: '#e0a458' } },
];

const outline = (p: Bounds) => [
  { x: p.x, y: p.y }, { x: p.x + p.width, y: p.y }, { x: p.x + p.width, y: p.y + p.height }, { x: p.x, y: p.y + p.height },
];

export function ScopedGridDemo() {
  const scene = useScene<Data, 'default', Bounds>({ systemLayers: [{ id: 'default' }], initial: NODES });
  const grid = useMemo(() => createGridLayer({
    spacing: 20,
    scopes: SCOPES,
    accentEvery: 5,
    regions: () => sceneGridRegions(scene, ROOT, (id) => {
      const pose = scene.nodes.get(id)?.pose;
      return pose ? outline(pose) : null;
    }),
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
