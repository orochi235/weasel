import { useState } from 'react';
import {
  gridSnapStrategy,
  SceneCanvas,
  useScene,
  useSelection,
  useHandTool,
  useWheelZoomTool,
  useWheelPanTool,
  useKeyboardZoomTool,
} from '@orochi235/weasel';
import type { UnitSystem } from '@orochi235/weasel';
import type { DrawCommand } from '@orochi235/weasel-gl';
import type { View } from '../../src/features/viewport/view';

interface NodeData { color: string }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const W = 400, H = 300;
// Demo unit system: base is the pixel, but the demo speaks in "tiles" worth 20px.
// Passing { value: 1, unit: 'tile' } at API boundaries resolves to 20 internally.
const UNITS: UnitSystem = { base: 'px', units: { px: 1, tile: 20 } };
const CELL = { value: 1, unit: 'tile' } as const;

export function MoveDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      { id: 'a' as never, kind: 'leaf', layer: 'default',
        pose: { x: 40,  y: 40,  width: 60, height: 40 }, data: { color: '#7fb069' } },
      { id: 'b' as never, kind: 'leaf', layer: 'default',
        pose: { x: 160, y: 100, width: 80, height: 60 }, data: { color: '#d4a574' } },
      { id: 'c' as never, kind: 'leaf', layer: 'default',
        pose: { x: 260, y: 60,  width: 60, height: 60 }, data: { color: '#a48bd4' } },
    ],
  });
  const selection = useSelection();

  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const hand = useHandTool();
  const wheelZoom = useWheelZoomTool();
  const wheelPan = useWheelPanTool();
  const keyZoom = useKeyboardZoomTool();

  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selection={selection}
      selectTool={{ snap: gridSnapStrategy<Pose>(CELL, UNITS) }}
      view={view}
      onViewChange={setView}
      ambient={[hand, wheelZoom, wheelPan, keyZoom]}
      layers={{
        grid: {
          spacing: CELL,
          unitSystem: UNITS,
          bounds: () => ({ x: 0, y: 0, width: W, height: H }),
          accentEvery: 5,
        },
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
