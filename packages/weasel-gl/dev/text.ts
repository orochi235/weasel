import { WeaselRenderer, registerFont } from '../src/index';
import type { DrawCommand } from '../src/DrawCommand';

const FONTS_BASE = '/packages/weasel-gl/fonts/inter';

async function main() {
  await registerFont('Inter', `${FONTS_BASE}/inter.json`, `${FONTS_BASE}/inter.png`);
  document.querySelector('p')!.textContent = 'Inter loaded.';

  const make = (id: string, w: number, h: number, cmds: DrawCommand[]) => {
    const c = document.getElementById(id) as HTMLCanvasElement;
    const gl = c.getContext('webgl2', {
      preserveDrawingBuffer: true,
      stencil: true,
    }) as WebGL2RenderingContext;
    const r = new WeaselRenderer({ gl, canvas: c, width: w, height: h, dpr: window.devicePixelRatio || 1 });
    r.render(cmds);
    return r;
  };

  make('cHello', 600, 80, [{
    kind: 'text',
    x: 20, y: 20,
    text: 'Hello, World!',
    style: { fontFamily: 'Inter', fontSize: 32, fill: { fill: 'solid', color: '#ffffff' } },
  }]);

  make('cSmall', 600, 60, [{
    kind: 'text',
    x: 20, y: 16,
    text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    style: { fontFamily: 'Inter', fontSize: 16, fill: { fill: 'solid', color: '#cccccc' } },
  }]);

  make('cLarge', 600, 120, [{
    kind: 'text',
    x: 20, y: 20,
    text: 'Weasel GL',
    style: { fontFamily: 'Inter', fontSize: 64, fill: { fill: 'solid', color: '#00aaff' } },
  }]);

  make('cZoom', 600, 200, [
    { kind: 'text', x: 20, y: 10,  text: 'MSDF', style: { fontFamily: 'Inter', fontSize: 12, fill: { fill: 'solid', color: '#aaa' } } },
    { kind: 'text', x: 20, y: 32,  text: 'MSDF', style: { fontFamily: 'Inter', fontSize: 24, fill: { fill: 'solid', color: '#ccc' } } },
    { kind: 'text', x: 20, y: 70,  text: 'MSDF', style: { fontFamily: 'Inter', fontSize: 48, fill: { fill: 'solid', color: '#eee' } } },
    { kind: 'text', x: 20, y: 130, text: 'MSDF', style: { fontFamily: 'Inter', fontSize: 64, fill: { fill: 'solid', color: '#fff' } } },
  ]);
}

main().catch(console.error);
