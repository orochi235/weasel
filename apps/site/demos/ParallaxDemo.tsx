import { useMemo, useState } from 'react';
import {
  SceneCanvas,
  WeaselProvider,
  asNodeId,
  useAnimator,
  useScene,
  createParallaxLayer,
  createParallaxPlane,
  createTiledLayer,
  ellipsePath,
} from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import type { ParallaxOpts, View, RenderLayer } from '@weasel-js/core';

interface NodeData { shape: string; sides?: number; fill: { color: string } }
interface Pose { x: number; y: number; width: number; height: number }

const W = 600, H = 400;

interface Shape { x: number; y: number; w: number; h: number; color: string }

// Each painter draws its shapes once, in the cell `[0, period)`.
// `createTiledLayer` below is what repeats them: it redraws the painter per
// visible copy through a shifted view, so panning loops forever and no painter
// carries wrap-around bookkeeping of its own.
function paintRects(id: string, shapes: Shape[]): RenderLayer<unknown> {
  return {
    id, label: id, space: 'world',
    draw: (): DrawCommand[] =>
      shapes.map((s) => ({
        kind: 'path',
        path: { kind: 'rect', x: s.x, y: s.y, width: s.w, height: s.h },
        fill: { fill: 'solid', color: s.color },
      })),
  };
}

// Clouds: four overlapping ellipses inside the bbox — three across the
// bottom and one smaller bump up top.
function paintClouds(id: string, shapes: Shape[]): RenderLayer<unknown> {
  return {
    id, label: id, space: 'world',
    draw: (): DrawCommand[] =>
      shapes.flatMap((s) => {
        const puffs = [
          { x: s.x,              y: s.y + s.h * 0.35, width: s.w * 0.45, height: s.h * 0.65 },
          { x: s.x + s.w * 0.55, y: s.y + s.h * 0.30, width: s.w * 0.45, height: s.h * 0.70 },
          { x: s.x + s.w * 0.25, y: s.y + s.h * 0.20, width: s.w * 0.50, height: s.h * 0.80 },
          { x: s.x + s.w * 0.30, y: s.y,              width: s.w * 0.40, height: s.h * 0.55 },
        ];
        return puffs.map((b) => ({
          kind: 'path' as const,
          path: ellipsePath(b),
          fill: { fill: 'solid' as const, color: s.color },
        }));
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

const GROUND: Shape[] = [
  { x: -200, y: 320, w: 1600, h: 80, color: '#a0875a' },
];

// Hills and trees are scene nodes on layers that carry `parallax`, so they
// paint through their plane and a click or marquee lands on them where they
// are drawn. Sky and ground stay paint: tiled render layers under planes.
type LayerId = 'hills' | 'trees';
const node = (id: string, layer: LayerId, pose: Pose, data: NodeData) =>
  ({ id: asNodeId(id), kind: 'leaf' as const, layer, pose, data });
const hill = (id: string, x: number, width: number, color: string) =>
  node(id, 'hills', { x, y: 200, width, height: 160 }, { shape: 'ellipse', fill: { color } });
const tree = (id: string, x: number) =>
  node(id, 'trees', { x, y: 330, width: 30, height: 50 }, { shape: 'polygon', sides: 3, fill: { color: '#3d5a3d' } });
const NODES = [
  hill('h1', 20, 220, '#8ba898'), hill('h2', 280, 280, '#7a9586'),
  hill('h3', 600, 260, '#8ba898'), hill('h4', 900, 240, '#7a9586'),
  tree('t1', 60), tree('t2', 180), tree('t3', 320), tree('t4', 470), tree('t5', 580),
];

// Depth per plane, and how far each is thrown before the intro settles it.
const DEPTH = {
  sky: { pan: 0.1, zoom: 0 },
  hills: { pan: 0.4, zoom: 0.3 },
  ground: { pan: 1, zoom: 1 },
  trees: { pan: 1.3, zoom: 1.5 },
};
type Plane = keyof typeof DEPTH;
const INTRO_FROM = -1200;
const opts = (p: Plane, zoomParallax: boolean, anchorX: number): ParallaxOpts => ({
  pan: DEPTH[p].pan,
  zoom: zoomParallax ? DEPTH[p].zoom : 1,
  anchor: { x: anchorX, y: 0 },
});

function ParallaxDemoInner() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [
      { id: 'hills', parallax: opts('hills', false, 0) },
      { id: 'trees', parallax: opts('trees', false, 0) },
    ],
    initial: NODES,
  });
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });
  const [zoomParallax, setZoomParallax] = useState(false);
  const animator = useAnimator();
  const [skyPlane] = useState(() => createParallaxPlane(opts('sky', false, 0)));
  const [groundPlane] = useState(() => createParallaxPlane(opts('ground', false, 0)));

  // One writer for every plane: the two render-layer planes, and the two
  // scene layers — written untracked, since a frame of an intro is not an edit.
  const apply = (zoom: boolean, anchorX: number) => {
    skyPlane.set(opts('sky', zoom, anchorX));
    groundPlane.set(opts('ground', zoom, anchorX));
    scene.untracked(() => {
      scene.setLayerParallax('hills', opts('hills', zoom, anchorX));
      scene.setLayerParallax('trees', opts('trees', zoom, anchorX));
    });
  };
  const playIntro = () => animator.tween({
    from: INTRO_FROM, to: 0, ms: 1400, easing: 'easeOutCubic',
    onTick: (x) => apply(zoomParallax, x), cancelKey: 'intro',
  });

  const [sky, ground] = useMemo(() => [
    createParallaxLayer<unknown>({
      id: 'parallax-sky', label: 'Sky', parallax: skyPlane,
      source: [createTiledLayer<unknown>({
        id: 'sky-tiled', label: 'Sky', source: [paintClouds('sky-shapes', SKY)], period: 1000,
      })],
    }),
    createParallaxLayer<unknown>({
      id: 'parallax-ground', label: 'Ground', parallax: groundPlane,
      source: [createTiledLayer<unknown>({
        id: 'ground-tiled', label: 'Ground', source: [paintRects('ground-shapes', GROUND)],
        // The one rect starts 200 units left of the cell, so the lattice has
        // to be told or the copy left of the view never draws.
        period: 1600, bleed: 200,
      })],
    }),
  ], [skyPlane, groundPlane]);

  return (
    <>
      <div className="ckd-toolbar">
        <button className="ckd-btn" onClick={playIntro}>play intro</button>
        <button className="ckd-btn" onClick={() => setView({ x: 0, y: 0, scale: { x: 1, y: 1 } })}>
          reset view
        </button>
        <label className="ckd-field">
          zoom
          <input
            type="range" min={0.5} max={3} step={0.05} value={view.scale.x}
            onChange={(e) => {
              const z = Number(e.target.value);
              setView({ ...view, scale: { x: z, y: z } });
            }}
          />
        </label>
        <label className="ckd-field">
          <input
            type="checkbox" checked={zoomParallax}
            onChange={(e) => { setZoomParallax(e.target.checked); apply(e.target.checked, 0); }}
          />
          per-plane zoom
        </label>
      </div>
      <SceneCanvas
        features={['view', 'pick']}
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        view={view}
        onViewChange={setView}
        viewport={{ pan: { axis: 'x' } }}
        selectionOptions={{ mode: 'multi' }}
        layers={{
          paraSky: { layer: sky, before: 'scene:hills' },
          paraGround: { layer: ground, before: 'scene:trees' },
        }}
      />
    </>
  );
}

export function ParallaxDemo() {
  return <WeaselProvider><ParallaxDemoInner /></WeaselProvider>;
}
