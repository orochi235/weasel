import { WeaselRenderer } from '../src/index';
import type { DrawCommand } from '../src/DrawCommand';
import {
  PATH_M, PATH_L, PATH_Z,
  type PolygonPath,
  type Stroke,
} from '@orochi235/weasel';

function rand(seed: number): number {
  return Math.abs(Math.sin(seed * 9301 + 49297) * 233280) % 1;
}

function randomRectCommand(seed: number, color: string): DrawCommand {
  const x = rand(seed) * 700;
  const y = rand(seed + 1) * 100;
  const w = 20 + rand(seed + 2) * 50;
  const h = 20 + rand(seed + 3) * 50;
  return {
    kind: 'path',
    path: { kind: 'rect', x, y, width: w, height: h },
    fill: { color },
  };
}

function buildScene(count: number): DrawCommand[] {
  const inner: DrawCommand[] = [];
  for (let i = 0; i < count; i++) {
    inner.push(randomRectCommand(i, `#${(i * 7919).toString(16).slice(0, 6).padEnd(6, '0')}`));
  }
  return [{ kind: 'group', alpha: 0.5, children: inner }];
}

const make = (id: string, w: number, h: number, scene: DrawCommand[]) => {
  const c = document.getElementById(id) as HTMLCanvasElement;
  const gl = c.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true }) as WebGL2RenderingContext;
  const r = new WeaselRenderer({ gl, canvas: c, width: w, height: h, dpr: window.devicePixelRatio || 1 });
  r.render(scene);
};

make('c10', 800, 200, buildScene(10));
make('c100', 800, 200, buildScene(100));
make('c1000', 800, 200, buildScene(1000));

// Evenodd: outer 200×200 square + inner 100×100 square. Stencil sorts overlap → ring.
const ringPath: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([
    PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,
    PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z,
  ]),
  coords: new Float32Array([
    50, 50, 250, 50, 250, 250, 50, 250,
    100, 100, 200, 100, 200, 200, 100, 200,
  ]),
  fillRule: 'evenodd',
};
make('cEvenodd', 400, 400, [{ kind: 'path', path: ringPath, fill: { color: '#00aaff' } }]);

// Helper for stroked open lines.
const strokeLine = (x1: number, y1: number, x2: number, y2: number, stroke: Stroke): DrawCommand => ({
  kind: 'path',
  path: {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L]),
    coords: new Float32Array([x1, y1, x2, y2]),
    fillRule: 'nonzero',
  },
  stroke,
});

// Helper for a stroked corner (two-segment open path).
const strokeCorner = (
  x1: number, y1: number, x2: number, y2: number, x3: number, y3: number,
  stroke: Stroke,
): DrawCommand => ({
  kind: 'path',
  path: {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L, PATH_L]),
    coords: new Float32Array([x1, y1, x2, y2, x3, y3]),
    fillRule: 'nonzero',
  },
  stroke,
});

const W = '#fff';

// cCaps: 3 horizontal lines side-by-side with butt / square / round.
make('cCaps', 800, 100, [
  strokeLine(40, 50, 240, 50, { paint: { color: W }, width: 20, cap: 'butt' }),
  strokeLine(280, 50, 480, 50, { paint: { color: W }, width: 20, cap: 'square' }),
  strokeLine(520, 50, 720, 50, { paint: { color: W }, width: 20, cap: 'round' }),
]);

// cJoins: 3 right-angle paths side-by-side, one per join style.
make('cJoins', 800, 200, [
  strokeCorner(40, 40, 240, 40, 240, 160, { paint: { color: W }, width: 24, join: 'bevel', cap: 'butt' }),
  strokeCorner(280, 40, 480, 40, 480, 160, { paint: { color: W }, width: 24, join: 'miter', cap: 'butt' }),
  strokeCorner(520, 40, 720, 40, 720, 160, { paint: { color: W }, width: 24, join: 'round', cap: 'butt' }),
]);

// cDash: 3 horizontal lines with different dash arrays.
make('cDash', 800, 100, [
  strokeLine(20, 30, 780, 30, { paint: { color: W }, width: 4, dash: [10, 10] }),
  strokeLine(20, 55, 780, 55, { paint: { color: W }, width: 4, dash: [5, 15] }),
  strokeLine(20, 80, 780, 80, { paint: { color: W }, width: 4, dash: [20, 5, 5, 5] }),
]);

// cAlign: a 100×100 rect stroked three ways (center/inner/outer) and a
// stenciled polygon stroked inner. Width is large so alignment is visible.
const rectAt = (x: number): DrawCommand => ({
  kind: 'path',
  path: { kind: 'rect', x, y: 50, width: 100, height: 100 },
  fill: { color: '#444' },
});
make('cAlign', 800, 200, [
  // Center alignment — stroke straddles edge.
  rectAt(40),
  { kind: 'path', path: { kind: 'rect', x: 40, y: 50, width: 100, height: 100 },
    stroke: { paint: { color: W }, width: 16, align: 'center' } },
  // Inner alignment — entirely inside.
  rectAt(220),
  { kind: 'path', path: { kind: 'rect', x: 220, y: 50, width: 100, height: 100 },
    stroke: { paint: { color: W }, width: 16, align: 'inner' } },
  // Outer alignment — entirely outside.
  rectAt(400),
  { kind: 'path', path: { kind: 'rect', x: 400, y: 50, width: 100, height: 100 },
    stroke: { paint: { color: W }, width: 16, align: 'outer' } },
  // PolygonPath inner-aligned (stencil-clipped).
  {
    kind: 'path',
    path: {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
      coords: new Float32Array([580, 50, 680, 50, 730, 150, 580, 150]),
      fillRule: 'nonzero',
    },
    fill: { color: '#444' },
    stroke: { paint: { color: W }, width: 16, align: 'inner' },
  },
]);
