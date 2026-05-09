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
import { useBackend } from '../BackendContext';

interface NodeData { color: string }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const W = 400, H = 300;
// Demo unit system: base is the pixel, but the demo speaks in "tiles" worth 20px.
// Passing { value: 1, unit: 'tile' } at API boundaries resolves to 20 internally.
const UNITS: UnitSystem = { base: 'px', units: { px: 1, tile: 20 } };
const CELL = { value: 1, unit: 'tile' } as const;

export function MoveDemo() {
  const backend = useBackend();
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
backend={backend}
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

export const MOVE_DEMO_SOURCE = `// Scene primitive owns nodes/poses/parenting and auto-records ops on every
// mutation. SceneCanvas synthesizes the adapter + internal select tool from
// the scene; consumers just describe their data and how to draw it. Wheel/
// keyboard zoom + pan tools come along via the ambient passthrough.

const scene = useScene<NodeData, 'default', Pose>({
  systemLayers: [{ id: 'default' }],
  initial: [
    { id: 'a', kind: 'leaf', layer: 'default', pose: {...}, data: { color: '#7fb069' } },
    { id: 'b', kind: 'leaf', layer: 'default', pose: {...}, data: { color: '#d4a574' } },
    { id: 'c', kind: 'leaf', layer: 'default', pose: {...}, data: { color: '#a48bd4' } },
  ],
});

const UNITS: UnitSystem = { base: 'px', units: { px: 1, tile: 20 } };
const CELL = { value: 1, unit: 'tile' } as const;

const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
const hand      = useHandTool();
const wheelZoom = useWheelZoomTool();
const wheelPan  = useWheelPanTool();
const keyZoom   = useKeyboardZoomTool();

return (
  <SceneCanvas
    width={W} height={H}
    scene={scene}
    selectTool={{ snap: gridSnapStrategy<Pose>(CELL, UNITS) }}
    view={view}
    onViewChange={setView}
    ambient={[hand, wheelZoom, wheelPan, keyZoom]}
    layers={{
      grid: { spacing: CELL, unitSystem: UNITS, bounds: () => ({ x: 0, y: 0, width: W, height: H }), accentEvery: 5 },
      scene: {
        drawOne: (cx, n, p) => { cx.fillStyle = n.data.color; cx.fillRect(p.x, p.y, p.width, p.height); },
      },
      selectionOverlay: { handles: false },
    }}
  />
);
// SceneCanvas wires the adapter, default pickEvery (renderOrder hit), default
// drawGhost (reuses scene.drawOne), and undo/redo via scene.batch(). The
// ambient list runs alongside the internal default select tool.
`;
