/**
 * Where a region export places what it draws. A document region draws every layer at its
 * document pose, parallax planes included, at any scale; a camera capture draws each plane
 * where that camera shows it, and its scale changes only the resolution.
 */
import { describe, expect, it } from 'vitest';
import { parallaxScene, type ParallaxScene } from '../../testing/parallaxScene';
import type { View } from 'core/viewport/view';
import type { ParallaxOptions } from 'core/viewport/parallax';
import { planPixelRender } from '../renderSceneToPixels';
import { buildSceneViewCommands } from '../sceneViewRender';
import { defaultDrawOne } from '../defaultDrawOne';
import { regionRenderArgs } from './regionRenderArgs';
import { selectionRegion } from './selectionRegion';
import { placedRects, type PlacedBox } from './placedRects.fixture';

type Box = { x: number; y: number; width: number; height: number };
const sceneWith = parallaxScene;
type S = ParallaxScene;

const region = (scene: S, r: Box, scale: number | { x: number; y: number }) => {
  const s = typeof scale === 'number' ? { x: scale, y: scale } : scale;
  return placedRects(planPixelRender({ ...regionRenderArgs(scene as never, r, { scale: 1 }), scale: s }).commands);
};
const capture = (scene: S, camera: View, r: Box, scale: { x: number; y: number }) =>
  placedRects(planPixelRender({ ...regionRenderArgs(scene as never, r, { scale: 1 }), scale, camera }).commands);
const onScreen = (scene: S, camera: View) => placedRects(buildSceneViewCommands(scene, camera, defaultDrawOne, undefined, undefined, undefined, undefined, undefined, 1));

const times = (b: PlacedBox, k: number): PlacedBox => ({ x0: b.x0 * k, y0: b.y0 * k, x1: b.x1 * k, y1: b.y1 * k });
const close = (got: readonly PlacedBox[], want: readonly PlacedBox[]) => {
  expect(got).toHaveLength(want.length);
  got.forEach((b, i) => (['x0', 'y0', 'x1', 'y1'] as const).forEach((k) => expect(b[k]).toBeCloseTo(want[i]![k], 9)));
};

const PLANES: readonly ParallaxOptions[] = [
  { pan: 0.5 },
  { pan: { x: 0.25, y: 2 }, zoom: 0.5, anchor: { x: 37, y: -12 } },
  { pan: 1.5, zoom: { x: 2, y: 0.3 }, anchor: { x: -400, y: 900 } },
];

describe('a document region export of a scene with parallax layers', () => {
  it('places a node on a panning plane at its document pose: the reproduction', () => {
    const scene = sceneWith({ pan: 0.5 });
    const r = selectionRegion(scene as never, ['a'])!;
    expect(r).toMatchObject({ x: 100, y: 0, width: 10, height: 10 });
    expect(region(scene, r, 1)).toEqual([{ x0: 0, y0: 0, x1: 10, y1: 10 }, { x0: 0, y0: 0, x1: 10, y1: 10 }]);
  });

  it.each(PLANES)('draws a plane where a plain layer draws the same pose, at every origin and scale (%o)', (plane) => {
    const scene = sceneWith(plane);
    for (const r of [{ x: 90, y: -5, width: 40, height: 40 }, { x: -3000, y: 2000, width: 6000, height: 10 }]) {
      const at1 = region(scene, r, 1);
      expect(at1[0]).toEqual(at1[1]);
      close(region(scene, r, 3), at1.map((b) => times(b, 3)));
    }
  });

  it('holds on a flipped, anisotropic output', () => {
    const scene = sceneWith(PLANES[1]!);
    const got = region(scene, { x: 90, y: -5, width: 40, height: 40 }, { x: 2, y: -0.5 });
    expect(got[0]).toEqual(got[1]);
    // x: (100 - 90) × 2; y flipped about the far edge: (35 - 10) × 0.5 to (35 - 0) × 0.5.
    expect(got[0]).toEqual({ x0: 20, y0: 12.5, x1: 40, y1: 17.5 });
  });
});

describe('a camera capture of a scene with parallax layers', () => {
  const cameras: readonly View[] = [
    { x: 60, y: -10, scale: { x: 2, y: 2 } },
    { x: -250, y: 40, scale: { x: 0.5, y: 3 } },
    { x: 300, y: 80, scale: { x: 1.5, y: -1.5 } },
  ];

  it.each(PLANES)('matches what the camera shows on screen, at any output scale (%o)', (plane) => {
    const scene = sceneWith(plane);
    for (const camera of cameras) {
      const shown = onScreen(scene, camera);
      const w = 200 / Math.abs(camera.scale.x);
      const h = 100 / Math.abs(camera.scale.y);
      const r = {
        x: camera.scale.x < 0 ? camera.x - w : camera.x, y: camera.scale.y < 0 ? camera.y - h : camera.y, width: w, height: h,
      };
      close(capture(scene, camera, r, camera.scale), shown);
      const half = { x: camera.scale.x / 2, y: camera.scale.y / 2 };
      close(capture(scene, camera, r, half), shown.map((b) => times(b, 0.5)));
    }
  });
});
