import { WeaselRenderer } from '../src/index';
import type { DrawCommand } from '../src/DrawCommand';
import {
  PATH_M, PATH_L, PATH_Z,
  type PolygonPath,
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
