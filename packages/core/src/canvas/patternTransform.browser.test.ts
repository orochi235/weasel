/**
 * A pattern's `transform` against real WebGL2. A hatch tile draws `/`
 * diagonals; turned 45° clockwise (y down) they lie horizontal, so every row
 * of the output is one value along x. Unturned, no row is.
 */
import { describe, it, expect } from 'vitest';
import type { FillStyle, PatternTransform } from '@weasel-js/paint';
import { composePatternTransform } from '@weasel-js/paint';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'features/groups/composePose';
import { resolveFillPattern } from 'features/patterns/resolveSpec';
import { renderSceneToPixels, type RasterImage } from './renderSceneToPixels';
import type { DrawCommand } from '../renderer/DrawCommand';

const W = 64;
const H = 48;

function render(transform: PatternTransform | undefined): RasterImage {
  const paint: FillStyle = {
    fill: 'pattern',
    pattern: { tile: 'hatch', color: '#ffffff', size: 8, lineWidth: 2 },
    units: 'world',
    transform,
  };
  const fill = resolveFillPattern(paint)!;
  const drawOne = (_node: unknown, p: RectPose): DrawCommand[] => [{
    kind: 'path',
    path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
    fill,
  } as DrawCommand];
  const scene = createScene<null, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: W, height: H }, data: null });
  return renderSceneToPixels({
    scene,
    drawOne: drawOne as never,
    sourceRect: { x: 0, y: 0, width: W, height: H },
    scale: { x: 1, y: 1 },
    background: '#000000',
  });
}

/** Red channel's spread (max − min) along each row. */
function rowSpreads(img: RasterImage): number[] {
  const out: number[] = [];
  for (let y = 0; y < img.height; y++) {
    let lo = 255;
    let hi = 0;
    for (let x = 0; x < img.width; x++) {
      const r = img.data[(y * img.width + x) * 4];
      lo = Math.min(lo, r);
      hi = Math.max(hi, r);
    }
    out.push(hi - lo);
  }
  return out;
}

function rowMeans(img: RasterImage): number[] {
  const out: number[] = [];
  for (let y = 0; y < img.height; y++) {
    let sum = 0;
    for (let x = 0; x < img.width; x++) sum += img.data[(y * img.width + x) * 4];
    out.push(sum / img.width);
  }
  return out;
}

describe('pattern transform', () => {
  it('leaves an untransformed hatch diagonal: every row varies along x', () => {
    expect(Math.min(...rowSpreads(render(undefined)))).toBeGreaterThan(128);
  });

  it('turns the hatch horizontal under a 45° rotation', () => {
    const img = render(composePatternTransform({ rotation: Math.PI / 4 }));
    // Each row is flat along x, up to the raster tile's own antialiasing...
    const spreads = rowSpreads(img);
    expect(spreads.reduce((a, b) => a + b, 0) / spreads.length).toBeLessThan(32);
    // ...and the rows themselves alternate between line and gap.
    const means = rowMeans(img);
    expect(Math.max(...means) - Math.min(...means)).toBeGreaterThan(128);
  });

  it('draws nothing for a transform that collapses the tile', () => {
    const img = render([1, 1, 1, 1]);
    expect(Math.max(...rowMeans(img))).toBe(0);
  });
});
