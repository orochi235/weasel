import { WeaselRenderer } from '../src/index';
import type { DrawCommand } from '../src/DrawCommand';
import {
  PATH_M, PATH_L, PATH_Z,
  type PolygonPath,
} from '@orochi235/weasel';

const status = document.getElementById('status')!;

function make(id: string, w: number, h: number, cmds: DrawCommand[]) {
  const c = document.getElementById(id) as HTMLCanvasElement;
  const gl = c.getContext('webgl2', {
    preserveDrawingBuffer: true,
    stencil: true,
  }) as WebGL2RenderingContext;
  const r = new WeaselRenderer({ gl, canvas: c, width: w, height: h, dpr: window.devicePixelRatio || 1 });
  r.render(cmds);
}

// Vertex-color rectangle. Use a 4-vertex polygon path (CCW) so vertex
// indices match: 0=top-left, 1=top-right, 2=bottom-right, 3=bottom-left.
const rectPath: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
  coords: new Float32Array([20, 20, 380, 20, 380, 180, 20, 180]),
  fillRule: 'nonzero',
};

// One color per vertex (RGBA, 0..1). Top-left red, top-right green,
// bottom-right blue, bottom-left yellow.
const cornerColors = [
  1, 0, 0, 1,   // TL: red
  0, 1, 0, 1,   // TR: green
  0, 0, 1, 1,   // BR: blue
  1, 1, 0, 1,   // BL: yellow
];

make('cVColor', 400, 200, [{
  kind: 'path',
  path: rectPath,
  fill: { color: '#ffffff' }, // multiplied with vertex colors in shader
  vertexColors: cornerColors,
}]);

// Color matrix: 120° hue rotation (Red→Green→Blue cycle).
// Naive RGB axis rotation about the (1,1,1) luma axis.
// For +120°: pure red → pure green; pure green → pure blue; pure blue → pure red.
//
// Verify pure red: R' = -0.5, G' = 0.866, B' = -0.366 → clamp → (0, 0.866, 0) = green.
const hue120 = new Float32Array([
   -0.5,   -0.366,   0.866,  0, 0,
    0.866, -0.5,    -0.366,  0, 0,
   -0.366,  0.866,  -0.5,    0, 0,
    0,      0,        0,      1, 0,
]);

make('cMatrix', 400, 100, [{
  kind: 'group',
  colorMatrix: Array.from(hue120),
  children: [{
    kind: 'path',
    path: { kind: 'rect', x: 20, y: 20, width: 360, height: 60 },
    fill: { color: '#ff0000' },  // red — should rotate to green-ish
  }],
}]);

// Composed: outer hue-rotate, inner uses vertex colors. The vertex colors
// pass through the inner shader, then the outer color matrix applies in
// the inner group's parent context.
make('cBoth', 400, 200, [{
  kind: 'group',
  colorMatrix: Array.from(hue120),
  children: [{
    kind: 'path',
    path: rectPath,
    fill: { color: '#ffffff' },
    vertexColors: cornerColors,
  }],
}]);

status.textContent = 'Colors smoke ready.';
