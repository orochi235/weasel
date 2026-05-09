import { WeaselRenderer } from '../src/index';
import type { DrawCommand } from '../src/DrawCommand';

async function main() {
  const status = document.getElementById('status')!;

  const make = (id: string, w: number, h: number, cmds: DrawCommand[]) => {
    const c = document.getElementById(id) as HTMLCanvasElement;
    const gl = c.getContext('webgl2', {
      preserveDrawingBuffer: true,
      stencil: true,
    }) as WebGL2RenderingContext;
    const r = new WeaselRenderer({ gl, canvas: c, width: w, height: h, dpr: window.devicePixelRatio || 1 });
    r.render(cmds);
  };

  // cLinear: a 380×80 rect filled with a horizontal linear gradient.
  make('cLinear', 400, 100, [{
    kind: 'path',
    path: { kind: 'rect', x: 10, y: 10, width: 380, height: 80 },
    fill: {
      fill: 'linear-gradient',
      from: { x: 10, y: 50 },
      to: { x: 390, y: 50 },
      stops: [
        { offset: 0, color: '#ff0000' },
        { offset: 1, color: '#0000ff' },
      ],
    },
  }]);

  // cRadial: yellow center fading to black at radius 100.
  make('cRadial', 400, 200, [{
    kind: 'path',
    path: { kind: 'rect', x: 10, y: 10, width: 380, height: 180 },
    fill: {
      fill: 'radial-gradient',
      center: { x: 200, y: 100 },
      radius: 150,
      stops: [
        { offset: 0, color: '#ffff00' },
        { offset: 1, color: '#000000' },
      ],
    },
  }]);

  // cConic: rainbow sweep around (200, 100).
  make('cConic', 400, 200, [{
    kind: 'path',
    path: { kind: 'rect', x: 10, y: 10, width: 380, height: 180 },
    fill: {
      fill: 'conic-gradient',
      center: { x: 200, y: 100 },
      angle: 0,
      stops: [
        { offset: 0,    color: '#ff0000' },
        { offset: 0.17, color: '#ffff00' },
        { offset: 0.33, color: '#00ff00' },
        { offset: 0.5,  color: '#00ffff' },
        { offset: 0.67, color: '#0000ff' },
        { offset: 0.83, color: '#ff00ff' },
        { offset: 1,    color: '#ff0000' },
      ],
    },
  }]);

  // cImage: build a procedural ImageBitmap (32×32 RGBA gradient pattern).
  const off = new OffscreenCanvas(64, 64);
  const ctx = off.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 64, 64);
  grad.addColorStop(0, '#ff0080');
  grad.addColorStop(1, '#00ff80');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#000';
  ctx.fillRect(28, 28, 8, 8);
  const bitmap = await createImageBitmap(off);
  make('cImage', 400, 200, [{
    kind: 'image',
    image: bitmap,
    x: 50, y: 30,
    w: 300, h: 140,
    opacity: 1,
  }]);

  status.textContent = 'Paint smoke ready.';
}

main().catch(console.error);
