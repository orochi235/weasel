import { useMemo, useState } from 'react';
import { SceneCanvas, useScene, useSelection } from '@weasel-js/core';
import { snapToContainer, snapBackOrDelete } from '@weasel-js/core/move';
import type { DrawCommand } from '../../../src/renderer';
import type { View } from '../../../src/core/viewport/view';

interface NodeData { color: string }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const W = 460, H = 320;
const BIN_A = { x: 40, y: 200, width: 160, height: 90 };
const BIN_B = { x: 260, y: 200, width: 160, height: 90 };
const inside = (b: { x: number; y: number; width: number; height: number }, wx: number, wy: number) =>
  wx >= b.x && wx <= b.x + b.width && wy >= b.y && wy <= b.y + b.height;

export function MoveSnapDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      { id: 'binA' as never, kind: 'container', layer: 'default', pose: BIN_A, data: { color: '#e8efe4' } },
      { id: 'binB' as never, kind: 'container', layer: 'default', pose: BIN_B, data: { color: '#efe9e4' } },
      { id: 'token' as never, kind: 'leaf', layer: 'default', pose: { x: 210, y: 40, width: 40, height: 40 }, data: { color: '#7fb069' } },
    ],
  });
  const selection = useSelection();
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });

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
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selection={selection}
      selectTool={{ move: { behaviors } }}
      view={view}
      onViewChange={setView}
      viewport={{}}
      layers={{
        scene: {
          drawOne: (n, p): DrawCommand[] => [{
            kind: 'path',
            path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
            fill: { color: n.data.color },
          }],
        },
        selectionOverlay: { handles: false },
      }}
    />
  );
}
