import { useMemo, useState } from 'react';
import {
  SceneCanvas,
  WeaselProvider,
  useScene,
  useSelection,
  useHandTool,
  useTools,
  createParallaxLayer,
  ellipsePath,
  polygonFromPoints,
} from '@orochi235/weasel';
import type { DrawCommand } from '../../src/renderer';
import type { View } from '../../src/core/viewport/view';
import type { RenderLayer } from '../../src/core/layers/render';

interface NodeData { color: string }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const W = 600, H = 400;

interface Shape { x: number; y: number; w: number; h: number; color: string }

// World→screen bbox project, used by every paint helper below. Layers are
// `space: 'world'` but their parallax wrapper emits `space: 'screen'`, so
// we project inline rather than letting the renderer apply a view transform.
function project(s: Shape, v: View) {
  return {
    x: (s.x - v.x) * v.scale.x,
    y: (s.y - v.y) * v.scale.y,
    w: s.w * v.scale.x,
    h: s.h * v.scale.y,
  };
}

// Yield every visible copy of `shapes`, tiled with period `period` along the
// x axis. For a layer that wants to loop seamlessly: pan in either direction
// keeps producing new copies because we walk every integer `k` whose copy
// `(s.x + k*period)` overlaps the visible world range.
function tiledProject(
  shapes: Shape[],
  v: View,
  dims: { width: number; height: number },
  period: number,
): { s: Shape; p: ReturnType<typeof project> }[] {
  const visStart = v.x;
  const visEnd = v.x + dims.width / v.scale.x;
  const out: { s: Shape; p: ReturnType<typeof project> }[] = [];
  for (const s of shapes) {
    const kMin = Math.ceil((visStart - s.w - s.x) / period);
    const kMax = Math.floor((visEnd - s.x) / period);
    for (let k = kMin; k <= kMax; k++) {
      const shifted: Shape = { ...s, x: s.x + k * period };
      out.push({ s, p: project(shifted, v) });
    }
  }
  return out;
}

function paintRects(id: string, shapes: Shape[], period: number): RenderLayer<unknown> {
  return {
    id, label: id, space: 'world',
    draw: (_d, v, dims): DrawCommand[] =>
      tiledProject(shapes, v, dims, period).map(({ s, p }) => ({
        kind: 'path',
        path: { kind: 'rect', x: p.x, y: p.y, width: p.w, height: p.h },
        fill: { fill: 'solid', color: s.color },
      })),
  };
}

// Clouds: four overlapping ellipses inside the bbox — three across the
// bottom and one smaller bump up top.
function paintClouds(id: string, shapes: Shape[], period: number): RenderLayer<unknown> {
  return {
    id, label: id, space: 'world',
    draw: (_d, v, dims): DrawCommand[] =>
      tiledProject(shapes, v, dims, period).flatMap(({ s, p }) => {
        const puffs = [
          { x: p.x,                y: p.y + p.h * 0.35, width: p.w * 0.45, height: p.h * 0.65 },
          { x: p.x + p.w * 0.55,   y: p.y + p.h * 0.30, width: p.w * 0.45, height: p.h * 0.70 },
          { x: p.x + p.w * 0.25,   y: p.y + p.h * 0.20, width: p.w * 0.50, height: p.h * 0.80 },
          { x: p.x + p.w * 0.30,   y: p.y,              width: p.w * 0.40, height: p.h * 0.55 },
        ];
        return puffs.map((b) => ({
          kind: 'path' as const,
          path: ellipsePath(b),
          fill: { fill: 'solid' as const, color: s.color },
        }));
      }),
  };
}

// Hills: half-sine bump across the top, flat bottom.
function paintHills(id: string, shapes: Shape[], period: number): RenderLayer<unknown> {
  return {
    id, label: id, space: 'world',
    draw: (_d, v, dims): DrawCommand[] =>
      tiledProject(shapes, v, dims, period).map(({ s, p }) => {
        const N = 16;
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i <= N; i++) {
          const t = i / N;
          pts.push({
            x: p.x + t * p.w,
            y: p.y + p.h * (1 - Math.sin(Math.PI * t)),
          });
        }
        pts.push({ x: p.x + p.w, y: p.y + p.h });
        pts.push({ x: p.x,       y: p.y + p.h });
        return {
          kind: 'path',
          path: polygonFromPoints(pts),
          fill: { fill: 'solid', color: s.color },
        };
      }),
  };
}

// Trees: triangle foliage on top + small brown trunk at the bottom-center.
// Foliage takes 75% of the bbox height; trunk fills the remaining 25%.
const TRUNK_COLOR = '#5a3a1f';
function paintTrees(id: string, shapes: Shape[], period: number): RenderLayer<unknown> {
  return {
    id, label: id, space: 'world',
    draw: (_d, v, dims): DrawCommand[] =>
      tiledProject(shapes, v, dims, period).flatMap(({ s, p }) => {
        const foliageH = p.h * 0.75;
        const trunkH = p.h - foliageH;
        const trunkW = p.w * 0.25;
        return [
          {
            kind: 'path' as const,
            path: polygonFromPoints([
              { x: p.x + p.w / 2, y: p.y },
              { x: p.x,           y: p.y + foliageH },
              { x: p.x + p.w,     y: p.y + foliageH },
            ]),
            fill: { fill: 'solid' as const, color: s.color },
          },
          {
            kind: 'path' as const,
            path: {
              kind: 'rect' as const,
              x: p.x + (p.w - trunkW) / 2,
              y: p.y + foliageH,
              width: trunkW,
              height: trunkH,
            },
            fill: { fill: 'solid' as const, color: TRUNK_COLOR },
          },
        ];
      }),
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

function ParallaxDemoInner() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });
  const selection = useSelection();
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });
  const [zoomParallax, setZoomParallax] = useState(false);
  // Wheel pan is now handled by the viewport.pan descriptor (both axes).
  // The x-axis-only locking previously provided by useWheelPanTool({ axis: 'x' })
  // is not replicated — the descriptor pans both axes.
  const hand = useHandTool({ axis: 'x', inertia: {} });
  const tools = useTools({ active: 'hand', registry: { hand } });

  const sky = useMemo(
    () => createParallaxLayer<unknown>({
      id: 'parallax-sky', label: 'Sky',
      source: [paintClouds('sky-shapes', SKY, 1000)],
      pan: 0.1,
      ...(zoomParallax ? { zoom: 0 } : {}),
    }),
    [zoomParallax],
  );
  const hills = useMemo(
    () => createParallaxLayer<unknown>({
      id: 'parallax-hills', label: 'Hills',
      source: [paintHills('hills-shapes', HILLS, 1140)],
      pan: 0.4,
      ...(zoomParallax ? { zoom: 0.3 } : {}),
    }),
    [zoomParallax],
  );
  const ground = useMemo(
    () => createParallaxLayer<unknown>({
      id: 'parallax-ground', label: 'Ground',
      source: [paintRects('ground-shapes', GROUND, 1600)],
      pan: 1.0,
      ...(zoomParallax ? { zoom: 1 } : {}),
    }),
    [zoomParallax],
  );
  const foreground = useMemo(
    () => createParallaxLayer<unknown>({
      id: 'parallax-foreground', label: 'Foreground',
      source: [paintTrees('fg-shapes', FOREGROUND, 640)],
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
          Drag or scroll-wheel to pan (x only, loops forever). Sky lags · hills slow · ground 1:1 · foreground leads. Toggle per-plane zoom to see depth-aware scaling.
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
        tools={tools}
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

export function ParallaxDemo() {
  return <WeaselProvider><ParallaxDemoInner /></WeaselProvider>;
}
