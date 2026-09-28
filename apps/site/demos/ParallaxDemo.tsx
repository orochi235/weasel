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
  polygonFromPoints,
  rectPath,
  solid,
} from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import type { FillStyle, ParallaxOpts, Path, View, RenderLayer } from '@weasel-js/core';

type NodeData = { path: Path; fill: FillStyle } | { fill: null };
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
const leaf = (id: string, layer: LayerId, pose: Pose, path: Path, color: string, parent?: string) =>
  ({ id: asNodeId(id), kind: 'leaf' as const, layer, pose, parent: parent ? asNodeId(parent) : null, data: { path, fill: solid(color) } });

// A half-sine bump across the top of the box, flat along the bottom.
const hill = (id: string, x: number, y: number, w: number, h: number, color: string) => {
  const N = 16;
  const top = Array.from({ length: N + 1 }, (_, i) => ({ x: (i / N) * w, y: h * (1 - Math.sin((Math.PI * i) / N)) }));
  return leaf(id, 'hills', { x, y, width: w, height: h }, polygonFromPoints([...top, { x: w, y: h }, { x: 0, y: h }]), color);
};

// A tree is a group, so a click selects the whole tree; `fill: null` keeps the
// rect fallback from painting the group's box. Foliage over the top
// three quarters of the box, trunk centered below it.
const TRUNK_COLOR = '#5a3a1f';
const tree = (id: string, x: number, y: number, w: number, h: number) => {
  const fh = h * 0.75, tw = w * 0.25;
  return [
    { id: asNodeId(id), kind: 'container' as const, layer: 'trees' as const, pose: { x, y, width: w, height: h }, parent: null, data: { fill: null } },
    leaf(`${id}-foliage`, 'trees', { x, y, width: w, height: fh },
      polygonFromPoints([{ x: w / 2, y: 0 }, { x: w, y: fh }, { x: 0, y: fh }]), '#3d5a3d', id),
    leaf(`${id}-trunk`, 'trees', { x: x + (w - tw) / 2, y: y + fh, width: tw, height: h - fh },
      rectPath(0, 0, tw, h - fh), TRUNK_COLOR, id),
  ];
};
const NODES = [
  hill('h1', 20, 260, 220, 60, '#8ba898'), hill('h2', 280, 250, 280, 70, '#7a9586'),
  hill('h3', 600, 255, 260, 65, '#8ba898'), hill('h4', 900, 260, 240, 60, '#7a9586'),
  ...tree('t1', 60, 340, 25, 50), ...tree('t2', 180, 350, 30, 45), ...tree('t3', 320, 345, 28, 48),
  ...tree('t4', 470, 355, 22, 42), ...tree('t5', 580, 348, 32, 46),
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
