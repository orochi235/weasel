import { useState } from 'react';
import { SceneCanvas, asNodeId, createScene, RIGID_POSE_COMPOSITION, solid } from '@weasel-js/core';
import type { Fill, GroupBoxData, RectPose, Stroke } from '@weasel-js/core';
import { tileGrid } from '@weasel-js/guides';
import { DemoStage } from './DemoStage';
import { movePreset, pickPreset } from '@weasel-js/editing';

type Data = GroupBoxData & { fill?: Fill; stroke?: Stroke };

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
      // The backing is the group's box, so it stays put while the tiles scroll.
      data: { background: { paint: solid('#fbf7ee') }, border: { paint: solid('#d4c4a8'), width: 1 } },
      layout: tileGrid<RectPose>({ cols: 3, rows: 2, gap: 10, overflow: 'scroll' }),
    }],
  });
  for (let i = 0; i < 14; i++) {
    scene.add({
      kind: 'mark', layer: 'default', parent: GRID,
      pose: { x: 0, y: 0, width: 90, height: 80 },
      data: { fill: { paint: solid(COLORS[i % COLORS.length]) } },
    });
  }
  return scene;
}

export function ScrollingGridDemo() {
  const [scene] = useState(buildScene);
  return (
    <DemoStage width={420} height={260}>
      <SceneCanvas features={[pickPreset, movePreset]} scene={scene} />
    </DemoStage>
  );
}
