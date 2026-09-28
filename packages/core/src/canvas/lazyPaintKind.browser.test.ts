/**
 * A lazily loaded paint kind against real WebGL2: a mesh fill met cold draws
 * nothing and starts the mesh module's load, and the frame after it lands
 * draws the mesh. Warming first makes the first frame draw it. Nothing here
 * may import the mesh module, or it would register before the test starts.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { FillStyle } from '@weasel-js/paint';
import { createScene } from 'core/scene/scene';
import {
  _resetPaintKindsForTests, getPaintKind, paintKindRegistry, warmPaintKinds,
} from 'core/paintKinds';
import type { RectPose } from 'features/groups/composePose';
import { renderSceneToPixels, type RasterImage } from './renderSceneToPixels';
import type { DrawCommand } from '../renderer/DrawCommand';

/** One straight-edged patch over the 64×48 output, green on the left, blue on
 *  the right, in the space the command's coordinates are in. */
function meshFill(): FillStyle {
  const corners = [{ x: 0, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 48 }, { x: 0, y: 48 }];
  const points = corners.flatMap((a, i) => {
    const b = corners[(i + 1) % 4];
    return [a, { x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3 }, { x: a.x + (2 * (b.x - a.x)) / 3, y: a.y + (2 * (b.y - a.y)) / 3 }];
  });
  return {
    fill: 'mesh-gradient',
    patches: [{ points, colors: ['#00ff00ff', '#0000ffff', '#0000ffff', '#00ff00ff'] }],
    units: 'world',
  } as unknown as FillStyle;
}

const drawOne = (_node: unknown, p: RectPose): DrawCommand[] => [{
  kind: 'path',
  path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
  fill: meshFill(),
} as DrawCommand];

function render(): RasterImage {
  const scene = createScene<null, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 64, height: 48 }, data: null });
  return renderSceneToPixels({
    scene,
    drawOne: drawOne as never,
    sourceRect: { x: 0, y: 0, width: 64, height: 48 },
    scale: { x: 1, y: 1 },
    background: '#000000',
  });
}

/** Pixels the mesh painted — green or blue lit, over a black background. */
function meshPixels(img: RasterImage): number {
  let n = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 1] > 64 || img.data[i + 2] > 64) n++;
  }
  return n;
}

beforeEach(() => { _resetPaintKindsForTests(); });
afterEach(() => { _resetPaintKindsForTests(); });

describe('lazily loaded paint kind', () => {
  it('draws nothing cold, starts the load, and draws the mesh once it lands', async () => {
    // Nothing but the render asks for the kind, so a registration arriving
    // here is the load that render started.
    const landed = new Promise<void>((resolve) => {
      const off = paintKindRegistry.subscribe(() => { off(); resolve(); });
    });

    expect(meshPixels(render())).toBe(0);
    await landed;
    expect(getPaintKind('mesh-gradient')).toBeDefined();
    expect(meshPixels(render())).toBeGreaterThan(64 * 48 * 0.9);
  });

  it('draws the mesh on the first frame when warmed ahead of it', async () => {
    await warmPaintKinds();
    expect(meshPixels(render())).toBeGreaterThan(64 * 48 * 0.9);
  });
});
