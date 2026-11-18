/**
 * A text layer draws what its texts draw one by one, against real WebGL2 and
 * the real Inter atlas: at rest, zoomed, turned, small enough for area
 * coverage, faked italic and turned glyph by glyph, and under a group's alpha,
 * color matrix and clip. Then that it holds what it uploaded across frames,
 * and stands aside for what its instances cannot carry.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { registerFont } from '@weasel-js/font';
import { WeaselRenderer } from '@weasel-js/renderer';
import type { GlMat3 } from '@weasel-js/geom';
import type { DrawCommand, TextDrawCommand } from './DrawCommand';
import metricsUrl from '../../../assets/fonts/inter/inter.json?url';
import atlasUrl from '../../../assets/fonts/inter/inter.png?url';

const FAMILY = 'text-layer-inter';
const W = 160;
const H = 96;
/** Channel levels the two may part by: the layer places corners in 32-bit floats on the GPU. */
const LEVELS = 3;

const renderers: WeaselRenderer[] = [];

beforeAll(async () => {
  await registerFont(FAMILY, { weight: 400, style: 'normal' }, metricsUrl, atlasUrl);
});

afterEach(() => {
  for (const r of renderers.splice(0)) r.dispose();
});

const ink = (color: string) => ({ paint: { kind: 'solid' as const, color } });

function text(x: number, y: number, s: string, fontSize: number, extra: Partial<TextDrawCommand['runs'][0]> = {}): TextDrawCommand {
  return {
    kind: 'text', x, y,
    runs: [{
      text: s, fontFamily: FAMILY, fontSize, fontWeight: 400, fontStyle: 'normal', fill: ink('#1d2a3a'),
      letterSpacing: 0, underline: false, strikethrough: false, overline: false, baselineShift: 0, ...extra,
    }],
    style: {},
  };
}

const GROUND: DrawCommand = { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: W, height: H }, fill: ink('#f4efe6') };

function open(): { renderer: WeaselRenderer; read: () => Uint8Array } {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const gl = canvas.getContext('webgl2', { stencil: true, antialias: false, preserveDrawingBuffer: true })!;
  const renderer = new WeaselRenderer({ gl, width: W, height: H, dpr: 1 });
  renderers.push(renderer);
  const px = new Uint8Array(W * H * 4);
  return { renderer, read: () => { gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px.slice(); } };
}

/** Largest channel difference, and how many pixels part past `LEVELS`. */
function compare(a: Uint8Array, b: Uint8Array): { max: number; over: number } {
  let max = 0, over = 0;
  for (let p = 0; p < a.length; p += 4) {
    let worst = 0;
    for (let c = 0; c < 4; c++) worst = Math.max(worst, Math.abs(a[p + c] - b[p + c]));
    max = Math.max(max, worst);
    if (worst > LEVELS) over++;
  }
  return { max, over };
}

/** `texts` drawn one by one and as a layer, wrapped by `wrap`, under `view`. */
function both(
  texts: TextDrawCommand[], view?: GlMat3, wrap: (inner: DrawCommand[]) => DrawCommand[] = (c) => c,
): { max: number; over: number; inked: number; calls: number } {
  const plain = open();
  plain.renderer.render([GROUND, ...wrap(texts)], view);
  const layered = open();
  layered.renderer.render([GROUND, ...wrap([{ kind: 'text-layer', texts }])], view);
  const a = plain.read();
  const inked = countInk(a);
  return { ...compare(a, layered.read()), inked, calls: layered.renderer.lastFrameStats().drawCalls };
}

/** Pixels darker than the ground, which says the case drew text at all. */
function countInk(px: Uint8Array): number {
  let n = 0;
  for (let p = 0; p < px.length; p += 4) if (px[p] < 200) n++;
  return n;
}

const view = (scale: number, turn: number, tx: number, ty: number): GlMat3 => {
  const c = Math.cos(turn) * scale, s = Math.sin(turn) * scale;
  return new Float32Array([c, s, 0, -s, c, 0, tx, ty, 1]);
};

const LINES = [
  text(4, 4, 'The quick brown fox', 14),
  text(4, 24, 'jumps over the lazy dog 0123', 9),
  text(4, 40, 'tiny tiny tiny tiny tiny tiny tiny', 5),
  text(4, 52, 'Hamburgefonstiv', 18, { fill: ink('#b03a2e') }),
];

describe('a text layer against its texts', () => {
  it('draws the same at rest', () => {
    const d = both(LINES);
    expect(d.inked).toBeGreaterThan(400);
    expect(d.over).toBe(0);
    // The ground's draw, then the layer's one instanced draw: text by text, both would share one.
    expect(d.calls).toBe(2);
  });

  it('draws the same zoomed in and panned', () => {
    const d = both(LINES, view(2.3, 0, -30, -20));
    expect(d.over).toBe(0);
    expect(d.calls).toBe(2);
  });

  it('draws the same zoomed out, where every glyph takes area coverage', () => {
    const d = both(LINES, view(0.45, 0, 10, 8));
    expect(d.over).toBe(0);
    expect(d.calls).toBe(2);
  });

  it('draws the same at the density of a million-glyph wall', () => {
    const rows: TextDrawCommand[] = [];
    for (let i = 0; i < 60; i++) rows.push(text(2, 2 + i * 1.5, 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ!?#%&abcdefghijklmnop', 1.3));
    const d = both(rows);
    expect(d.inked).toBeGreaterThan(1000);
    expect(d.over).toBe(0);
    expect(d.calls).toBe(2);
  });

  it('draws the same under a turned view', () => {
    const d = both(LINES, view(1.2, 0.5, 40, -10));
    expect(d.over).toBe(0);
    expect(d.calls).toBe(2);
  });

  it('draws faked italic and turned glyphs the same', () => {
    const texts = [
      text(6, 8, 'slanted text', 16, { fontStyle: 'italic' }),
      text(20, 40, 'turned', 14, { rotate: 25 }),
      text(10, 70, 'small slant', 6, { fontStyle: 'italic' }),
    ];
    for (const d of [both(texts), both(texts, view(0.6, 0.3, 30, 10))]) {
      expect(d.over).toBe(0);
      expect(d.calls).toBe(2);
    }
  });

  it('draws the same under a group with alpha, a color matrix and a clip', () => {
    // Swaps red and blue.
    const swap = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0];
    const d = both(LINES, view(1.1, 0, 3, 2), (children) => [{
      kind: 'group', alpha: 0.6, colorMatrix: swap,
      clip: { kind: 'rect', x: 10, y: 6, width: 110, height: 50 }, children,
    }]);
    expect(d.over).toBe(0);
  });

  it('keeps what it uploaded while the view moves', () => {
    const plain = open();
    const layered = open();
    const layer: DrawCommand = { kind: 'text-layer', texts: LINES };
    for (let f = 0; f < 4; f++) {
      const v = view(1 + 0.3 * f, 0.1 * f, -8 * f, 3 * f);
      plain.renderer.render([GROUND, ...LINES], v);
      layered.renderer.render([GROUND, layer], v);
      expect(compare(plain.read(), layered.read()).over).toBe(0);
    }
    // One instanced draw a frame, beside the ground's.
    expect(layered.renderer.lastFrameStats().drawCalls).toBe(2);
  });

  it('draws an underlined layer text by text', () => {
    const d = both([...LINES, text(4, 74, 'underlined', 12, { underline: true })]);
    expect(d.over).toBe(0);
    // Its glyphs and rules stage with the ground, as plain text would.
    expect(d.calls).toBe(1);
  });
});
