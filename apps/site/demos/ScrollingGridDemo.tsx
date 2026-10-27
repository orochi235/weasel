import { useState } from 'react';
import { SceneCanvas, asNodeId, createScene, RIGID_POSE_COMPOSITION } from '@weasel-js/core';
import type { RectPose } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { tileGrid } from '@weasel-js/guides';
import { DemoStage } from './DemoStage';

type Data = { color: string };

const GRID = asNodeId('grid');
const COLORS = ['#f5e3a3', '#e3a3f5', '#a3e3f5', '#a3f5c4', '#f5b8a3'];

// A 3 × 2 grid holding 14 tiles: with `overflow: 'scroll'` the extras take cells
// past its last row, and `clip: 'outline'` hides them until the wheel scrolls
// them in. The scroll is view state: no tile's stored pose changes.
function buildScene() {
  const scene = createScene<Data, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    composition: RIGID_POSE_COMPOSITION,
    initial: [{
      id: GRID, kind: 'group', layer: 'default', clip: 'outline',
      pose: { x: 40, y: 30, width: 330, height: 200 },
      data: { color: '#fbf7ee' },
      layout: tileGrid<RectPose>({ cols: 3, rows: 2, gap: 10, overflow: 'scroll' }),
    }],
  });
  for (let i = 0; i < 14; i++) {
    scene.add({
      kind: 'mark', layer: 'default', parent: GRID,
      pose: { x: 0, y: 0, width: 90, height: 80 },
      data: { color: COLORS[i % COLORS.length] },
    });
  }
  return scene;
}

export function ScrollingGridDemo() {
  const [scene] = useState(buildScene);
  return (
    <DemoStage width={420} height={260}>
      <SceneCanvas
        features={['pick', 'move']}
        scene={scene}
        layers={{
          scene: {
            drawOne: (node, p): DrawCommand[] => [{
              kind: 'path',
              path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
              fill: { paint: { color: node.data.color } },
              ...(node.id === GRID ? { stroke: { paint: { color: '#d4c4a8' }, width: 1 } } : {}),
            }],
          },
        }}
      />
    </DemoStage>
  );
}
