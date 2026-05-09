import { WeaselRenderer, mat3 } from '../src/index';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
// preserveDrawingBuffer so the Playwright smoke test can readPixels after render.
// Real consumers (and other dev pages) get the default — no perf cost paid here.
const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true }) as WebGL2RenderingContext;
const r = new WeaselRenderer({ gl, canvas, width: 800, height: 600, dpr: window.devicePixelRatio || 1 });

r.render([
  {
    kind: 'path',
    path: { kind: 'rect', x: 50, y: 50, width: 100, height: 100 },
    fill: { color: '#ff0000' },
  },
  // Full-opacity yellow rect — sits behind the half-opacity green so any
  // overlap visibly shows yellow bleeding through.
  {
    kind: 'path',
    path: { kind: 'rect', x: 250, y: 100, width: 100, height: 100 },
    fill: { color: '#ffff00' },
  },
  {
    kind: 'group',
    transform: mat3.translate(mat3.identity(), 200, 50),
    alpha: 0.5,
    children: [
      {
        kind: 'path',
        path: { kind: 'rect', x: 0, y: 0, width: 100, height: 100 },
        fill: { color: '#00ff00' },
      },
    ],
  },
]);
