import { useEffect, useState } from 'react';
import {
  gridSnapStrategy,
  SceneCanvas,
  useScene,
  useSelection,
  useZoom,
} from '@orochi235/weasel';
import type { UnitSystem } from '@orochi235/weasel';

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

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const zoomCtl = useZoom({
    zoom, setZoom, pan, setPan,
    viewport: { width: W, height: H },
    sources: { wheel: true, keys: true, doubleClick: true, pinch: true },
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => zoomCtl.onKeyDown(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoomCtl]);

  const clientToWorld = (canvas: HTMLCanvasElement, cx: number, cy: number): [number, number] => {
    const rect = canvas.getBoundingClientRect();
    const x = (cx - rect.left - pan.x) / zoom;
    const y = (cy - rect.top - pan.y) / zoom;
    return [x, y];
  };

  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selection={selection}
      snap={gridSnapStrategy<Pose>(CELL, UNITS)}
      clientToWorld={clientToWorld}
      layers={{
        grid: {
          spacing: CELL,
          unitSystem: UNITS,
          bounds: () => ({ x: 0, y: 0, width: W, height: H }),
          accentEvery: 5,
        },
        scene: {
          drawOne: (cx, n, p) => {
            cx.fillStyle = n.data.color;
            cx.fillRect(p.x, p.y, p.width, p.height);
          },
        },
        selectionOverlay: { handles: false },
      }}
    />
  );
}

export const MOVE_DEMO_SOURCE = `// Scene primitive owns nodes/poses/parenting and auto-records ops on every
// mutation. SceneCanvas synthesizes the adapter + internal select tool from
// the scene; consumers just describe their data and how to draw it.

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

return (
  <SceneCanvas
    width={W} height={H}
    scene={scene}
    snap={gridSnapStrategy<Pose>(CELL, UNITS)}
    clientToWorld={clientToWorld}
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
// drawGhost (reuses scene.drawOne), and undo/redo via scene.batch().
`;
