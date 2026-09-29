/**
 * A mesh drawn large has to bake large. Measured on pixels, in real WebGL2:
 * a hard color break inside a mesh is as sharp as one bake texel, so the
 * width of its blur in output pixels is the texel size the bake was drawn at.
 */
import { describe, it, expect } from 'vitest';
import type { FillStyle } from '@weasel-js/paint';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'features/groups/composePose';
import { renderSceneToPixels, type RasterImage } from '../../canvas/renderSceneToPixels';
import type { DrawCommand } from '../../renderer/DrawCommand';
import { meshFromStops } from './meshPaint';
import './register';

const W = 64;
const H = 4;

/** Red on the left half and blue on the right, meeting at a hard break: two
 *  bands with no gradient between them, over the whole `W × H` world box. */
function hardBreak(): FillStyle {
  const mesh = meshFromStops([
    { offset: 0, color: '#ff0000ff' },
    { offset: 0.5, color: '#ff0000ff' },
    { offset: 0.5, color: '#0000ffff' },
    { offset: 1, color: '#0000ffff' },
  ]);
  const patches = mesh.patches.map((patch) => ({
    ...patch,
    points: patch.points.map((p) => ({ x: p.x * W, y: p.y * H })),
  }));
  return { ...mesh, patches, units: 'world' } as unknown as FillStyle;
}

const drawOne = (_node: unknown, p: RectPose): DrawCommand[] => [{
  kind: 'path',
  path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
  fill: hardBreak(),
} as DrawCommand];

function render(scale: number): RasterImage {
  const scene = createScene<null, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: W, height: H }, data: null });
  return renderSceneToPixels({
    scene,
    drawOne: drawOne as never,
    sourceRect: { x: 0, y: 0, width: W, height: H },
    scale: { x: scale, y: scale },
    background: '#000000',
  });
}

/** Output pixels along the middle row that are neither the red side nor the
 *  blue side — the break's blur. */
function blurWidth(img: RasterImage): number {
  const y = Math.floor(img.height / 2);
  let n = 0;
  for (let x = 0; x < img.width; x++) {
    const red = img.data[(y * img.width + x) * 4];
    if (red > 16 && red < 239) n++;
  }
  return n;
}

/** The middle row's two ends, so a mesh that drew nothing cannot pass. */
function painted(img: RasterImage): { left: number[]; right: number[] } {
  const row = Math.floor(img.height / 2) * img.width;
  const at = (x: number) => Array.from(img.data.subarray((row + x) * 4, (row + x) * 4 + 3));
  return { left: at(4), right: at(img.width - 5) };
}

describe('mesh bake size', () => {
  it('bakes a poster-sized mesh finer than 256 texels, so a break stays sharp', () => {
    // 64 units at 32 px each: the mesh covers 2048 output pixels, where a
    // 256-texel bake stretches every texel over 8 of them.
    const img = render(32);
    expect(img.width).toBe(2048);
    expect(painted(img)).toEqual({ left: [255, 0, 0], right: [0, 0, 255] });
    const texelOf256 = img.width / 256;
    expect(blurWidth(img)).toBeLessThan(texelOf256 / 2);
  });

  it('keeps the break about one texel wide at every scale', () => {
    // Printed at 4 and at 32 px a unit, the blur in output pixels stays
    // bounded instead of growing with the scale.
    const smallImg = render(4);
    const largeImg = render(32);
    expect(painted(smallImg)).toEqual(painted(largeImg));
    const small = blurWidth(smallImg);
    const large = blurWidth(largeImg);
    expect(small).toBeLessThanOrEqual(3);
    expect(large).toBeLessThanOrEqual(3);
  });
});
