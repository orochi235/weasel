/**
 * An exported inner or outer text stroke as Chromium draws it: every strongly
 * inked pixel of an inner stroke lies on the glyphs, and of an outer one off
 * them. Font-independent: the glyphs are the same text drawn filled alone.
 */
import { describe, expect, it } from 'vitest';
import { serializeSvg } from '@weasel-js/svg';
import type { Stroke } from '@weasel-js/core';
import type { SvgTextNode } from './types';

const W = 240;
const H = 120;
const VIEW = { x: 0, y: 0, width: W, height: H };

const node = (fill: boolean, stroke?: Stroke): SvgTextNode => ({
  kind: 'text', x: 10, y: 10, width: 220, height: 100, text: 'Hi',
  style: { fontFamily: 'sans-serif', fontSize: 80 },
  fill: fill ? { paint: { kind: 'solid', color: '#000000' } } : null,
  ...(stroke ? { stroke } : {}),
});

/** Each pixel's alpha, 0–255, as the browser draws `svg` at `W`×`H`. */
async function alphas(svg: string): Promise<Uint8ClampedArray> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, W, H);
  const data = ctx.getImageData(0, 0, W, H).data;
  return data.filter((_, i) => i % 4 === 3);
}

const render = (n: SvgTextNode) => alphas(serializeSvg([n], { viewBox: VIEW, width: W, height: H }));

describe('an aligned text stroke drawn by the browser', () => {
  it.each(['inner', 'outer'] as const)('keeps a %s stroke on its own side of the glyph edge', async (align) => {
    const glyphs = await render(node(true));
    const stroked = await render(node(false, { paint: { color: '#0000ff' }, width: 6, align }));
    let strong = 0;
    let wrongSide = 0;
    for (let i = 0; i < stroked.length; i++) {
      if (stroked[i]! < 200) continue;
      strong++;
      const onGlyph = glyphs[i]! > 128;
      if (onGlyph !== (align === 'inner')) wrongSide++;
    }
    expect(strong).toBeGreaterThan(100);
    // Antialiased edges disagree by a pixel or so; a centered stroke puts half its ink on the wrong side.
    expect(wrongSide / strong).toBeLessThan(0.05);
  });
});
