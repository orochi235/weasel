import { useMemo } from 'react';
import { SceneCanvas, solid, useDepSource, useScene, useSelection, type Fill } from '@weasel-js/core';
import { snapToContainer, snapBackOrDelete } from '@weasel-js/core/move';
import { DemoStage } from './DemoStage';

/** The kit's default painter fills a rect-posed node with its `data.fill`. */
interface NodeData { fill: Fill }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const W = 460, H = 320;
const BIN_A = { x: 40, y: 200, width: 160, height: 90 };
const BIN_B = { x: 260, y: 200, width: 160, height: 90 };
const inside = (b: { x: number; y: number; width: number; height: number }, wx: number, wy: number) =>
  wx >= b.x && wx <= b.x + b.width && wy >= b.y && wy <= b.y + b.height;

/** The bins are marks, so a drop lands in one only because this says it may. */
function BinsTakeDrops(): null {
  useDepSource('canDropInto', () => (parent) => parent === 'binA' || parent === 'binB');
  return null;
}

export function MoveSnapDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      // The bins take drops at fixed rectangles, so they stay put: a dragged bin would plant itself.
      { id: 'binA' as never, kind: 'mark', layer: 'default', pose: BIN_A, pickable: false, data: { fill: { paint: solid('#e8efe4') } } },
      { id: 'binB' as never, kind: 'mark', layer: 'default', pose: BIN_B, pickable: false, data: { fill: { paint: solid('#efe9e4') } } },
      { id: 'token' as never, kind: 'mark', layer: 'default', pose: { x: 210, y: 40, width: 40, height: 40 }, data: { fill: { paint: solid('#7fb069') } } },
    ],
  });
  const selection = useSelection({ scene });

  const behaviors = useMemo(() => [
    snapToContainer<Pose>({
      dwellMs: 250,
      findTarget: (_id, wx, wy) => {
        if (inside(BIN_A, wx, wy)) return { parentId: 'binA', slotPose: { x: BIN_A.x + 20, y: BIN_A.y + 25, width: 40, height: 40 } };
        if (inside(BIN_B, wx, wy)) return { parentId: 'binB', slotPose: { x: BIN_B.x + 20, y: BIN_B.y + 25, width: 40, height: 40 } };
        return null;
      },
    }),
    snapBackOrDelete<Pose>({ radius: 30, onFreeRelease: 'snap-back' }),
  ], []);

  return (
    <DemoStage width={W} height={H}>
      <SceneCanvas features={['pick', 'move']}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        selectTool={{ move: { behaviors } }}
      >
        <BinsTakeDrops />
      </SceneCanvas>
    </DemoStage>
  );
}
