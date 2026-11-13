import { expect, test } from 'vitest';
import { ICON_FRAME, ICON_STROKE } from '@weasel-js/icons';
import { icons } from './icons.table';

const SIZE = 200;

/** The alpha a browser paints at a point on the 20x20 frame of kernel3d's glyph `name`, stroked as `<Icon>` strokes. */
async function alphaAt(name: string, x: number, y: number): Promise<number> {
  const body = icons.icons[name]!.body;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ICON_FRAME} ${ICON_FRAME}" width="${SIZE}" height="${SIZE}"`
    + ` fill="none" stroke="#000" stroke-width="${ICON_STROKE}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const img = new Image();
  img.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  return ctx.getImageData((x / ICON_FRAME) * SIZE, (y / ICON_FRAME) * SIZE, 1, 1).data[3]!;
}

// The ring's back arcs are drawn on past the axis and clipped by nested viewports; one that failed to clip
// would paint the ring straight across the band beside the axis.
test('the turn ring stops short of its axis at the back, and the axis is whole there', async () => {
  expect(await alphaAt('turnLeft', 8.2, 7.05)).toBe(255);
  expect(await alphaAt('turnLeft', 9.4, 6.85)).toBe(0);
  expect(await alphaAt('turnLeft', 12.1, 6.85)).toBe(0);
  expect(await alphaAt('turnLeft', 10.75, 6.8)).toBe(255);
});
