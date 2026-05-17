import { useMemo, useState } from 'react';
import {
  SceneCanvas,
  useScene,
  useSelection,
  useHandTool,
  createParallaxLayer,
} from '@orochi235/weasel';
import type { DrawCommand } from '../../src/renderer';
import type { View } from '../../src/core/viewport/view';
import type { RenderLayer } from '../../src/core/layers/render';

interface NodeData { color: string }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const W = 600, H = 400;

interface Shape { x: number; y: number; w: number; h: number; color: string }

function paintShapes(id: string, shapes: Shape[]): RenderLayer<unknown> {
  return {
    id,
    label: id,
    space: 'world',
    draw: (_data, v): DrawCommand[] =>
      shapes.map((s) => ({
        kind: 'path',
        path: {
          kind: 'rect',
          x: (s.x - v.x) * v.scale.x,
          y: (s.y - v.y) * v.scale.y,
          width: s.w * v.scale.x,
          height: s.h * v.scale.y,
        },
        fill: { fill: 'solid', color: s.color },
      })),
  };
}

const SKY: Shape[] = [
  { x:  40, y:  30, w: 90, h: 40, color: '#c7e0f5' },
  { x: 220, y:  60, w: 120, h: 35, color: '#c7e0f5' },
  { x: 420, y:  20, w: 100, h: 45, color: '#c7e0f5' },
  { x: 650, y:  50, w: 110, h: 38, color: '#c7e0f5' },
  { x: 880, y:  35, w: 95, h: 42, color: '#c7e0f5' },
];

const HILLS: Shape[] = [
  { x:  20, y: 200, w: 220, h: 60, color: '#8ba898' },
  { x: 280, y: 220, w: 280, h: 70, color: '#7a9586' },
  { x: 600, y: 210, w: 260, h: 65, color: '#8ba898' },
  { x: 900, y: 230, w: 240, h: 60, color: '#7a9586' },
];

const GROUND: Shape[] = [
  { x: -200, y: 320, w: 1600, h: 80, color: '#a0875a' },
];

const FOREGROUND: Shape[] = [
  { x:  60, y: 340, w: 25, h: 50, color: '#3d5a3d' },
  { x: 180, y: 350, w: 30, h: 45, color: '#3d5a3d' },
  { x: 320, y: 345, w: 28, h: 48, color: '#3d5a3d' },
  { x: 470, y: 355, w: 22, h: 42, color: '#3d5a3d' },
  { x: 580, y: 348, w: 32, h: 46, color: '#3d5a3d' },
];

export function ParallaxDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });
  const selection = useSelection();
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });
  const [zoomParallax, setZoomParallax] = useState(false);
  const hand = useHandTool();

  const sky = useMemo(
    () => createParallaxLayer<unknown>({
      id: 'parallax-sky', label: 'Sky',
      source: [paintShapes('sky-shapes', SKY)],
      pan: 0.1,
      ...(zoomParallax ? { zoom: 0 } : {}),
    }),
    [zoomParallax],
  );
  const hills = useMemo(
    () => createParallaxLayer<unknown>({
      id: 'parallax-hills', label: 'Hills',
      source: [paintShapes('hills-shapes', HILLS)],
      pan: 0.4,
      ...(zoomParallax ? { zoom: 0.3 } : {}),
    }),
    [zoomParallax],
  );
  const ground = useMemo(
    () => createParallaxLayer<unknown>({
      id: 'parallax-ground', label: 'Ground',
      source: [paintShapes('ground-shapes', GROUND)],
      pan: 1.0,
      ...(zoomParallax ? { zoom: 1 } : {}),
    }),
    [zoomParallax],
  );
  const foreground = useMemo(
    () => createParallaxLayer<unknown>({
      id: 'parallax-foreground', label: 'Foreground',
      source: [paintShapes('fg-shapes', FOREGROUND)],
      pan: 1.3,
      ...(zoomParallax ? { zoom: 1.5 } : {}),
    }),
    [zoomParallax],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'monospace' }}>
          view: ({view.x.toFixed(0)}, {view.y.toFixed(0)}) ×{view.scale.x.toFixed(2)}
        </span>
        <button onClick={() => setView({ x: 0, y: 0, scale: { x: 1, y: 1 } })}>
          Reset view
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          zoom
          <input
            type="range"
            min={0.5}
            max={3}
            step={0.05}
            value={view.scale.x}
            onChange={(e) => {
              const z = Number(e.target.value);
              setView({ ...view, scale: { x: z, y: z } });
            }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="checkbox"
            checked={zoomParallax}
            onChange={(e) => setZoomParallax(e.target.checked)}
          />
          per-plane zoom
        </label>
        <span style={{ color: '#888' }}>
          Drag to pan. Sky lags · hills slow · ground 1:1 · foreground leads. Toggle per-plane zoom to see depth-aware scaling.
        </span>
      </div>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        view={view}
        onViewChange={setView}
        ambient={[hand]}
        layers={{
          scene: { drawOne: () => [] },
          selectionOverlay: { handles: false },
          paraSky:        { layer: sky,        after: 'scene' },
          paraHills:      { layer: hills,      after: 'paraSky' },
          paraGround:     { layer: ground,     after: 'paraHills' },
          paraForeground: { layer: foreground, after: 'paraGround' },
        }}
      />
    </div>
  );
}
