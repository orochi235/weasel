/**
 * An imported `<g clip-path>` against real WebGL2: the group's content shows
 * inside the clip's outline and nowhere else in the group's box.
 */
import { describe, expect, it } from 'vitest';
import { createScene, renderSceneToPixels, type RasterImage } from '@weasel-js/core';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { openSvgText } from './openSvg';

const RECT = '<rect width="100" height="100" fill="#ff0000"/>';
const CLIP = '<clipPath id="c"><rect x="10" y="10" width="20" height="40"/></clipPath>';

function draw(body: string): RasterImage {
  const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: [{ id: 'default' }] });
  openSvgText(scene, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}</svg>`, 'a.svg');
  return renderSceneToPixels({
    scene,
    sourceRect: { x: 0, y: 0, width: 100, height: 100 },
    scale: { x: 1, y: 1 },
    background: '#ffffff',
  });
}

const rgb = (img: RasterImage, x: number, y: number): number[] =>
  Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 3));

const RED = [255, 0, 0];
const WHITE = [255, 255, 255];
const INSIDE = [20, 30] as const;
const BESIDE = [60, 30] as const;
const BELOW = [20, 70] as const;

describe('an imported clipped group', () => {
  it('draws its content across its whole box with no clip', () => {
    const img = draw(`<g>${RECT}</g>`);
    for (const [x, y] of [INSIDE, BESIDE, BELOW]) expect(rgb(img, x, y)).toEqual(RED);
  });

  it('draws its content inside the clip outline only', () => {
    const img = draw(`${CLIP}<g clip-path="url(#c)">${RECT}</g>`);
    expect(rgb(img, ...INSIDE)).toEqual(RED);
    expect(rgb(img, ...BESIDE)).toEqual(WHITE);
    expect(rgb(img, ...BELOW)).toEqual(WHITE);
  });
});
