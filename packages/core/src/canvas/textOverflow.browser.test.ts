/**
 * A text node that clips, against real WebGL2 and the real Inter files: no
 * glyph ink past its box, on either text tier, and none lost inside it. The
 * clip is a rect group the renderer cuts on the CPU, so these are pixel
 * probes rather than a baseline.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { registerFont, registerFontOutlines, outlineStatus } from '@weasel-js/font';
import { OUTLINE_MIN_SCREEN_PX } from '@weasel-js/renderer';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/composePose';
import { renderSceneToPixels, type RasterImage } from './renderSceneToPixels';
import metricsUrl from '../../../../assets/fonts/inter/inter.json?url';
import atlasUrl from '../../../../assets/fonts/inter/inter.png?url';
import ttfUrl from '../../../../assets/fonts/inter/inter.ttf?url';

const FAMILY = 'overflow-inter';
const FONT_SIZE = 32;
// Three lines of 40 in a box 40 tall: the second and third hang below it.
const POSE: RectPose = { x: 10, y: 10, width: 120, height: 40 };
const SOURCE = { x: 0, y: 0, width: 140, height: 140 };
const SDF_SCALE = (OUTLINE_MIN_SCREEN_PX / FONT_SIZE) * 0.92;
const OUTLINE_SCALE = (OUTLINE_MIN_SCREEN_PX / FONT_SIZE) * 1.08;

function render(overflow: 'visible' | 'clip', scale: number): RasterImage {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({
    kind: 'leaf', layer: 'main', pose: POSE,
    data: {
      text: 'HHHH\nHHHH\nHHHH',
      style: { fontFamily: FAMILY, fontSize: FONT_SIZE, lineHeight: 1.25 },
      fill: { paint: { kind: 'solid', color: '#ffffffff' } },
      overflow,
    },
  });
  return renderSceneToPixels({ scene, sourceRect: SOURCE, scale: { x: scale, y: scale }, background: '#000000' });
}

/** The brightest red channel in world rows `[y0, y1)`, across the source. */
function inkIn(img: RasterImage, scale: number, y0: number, y1: number): number {
  let max = 0;
  for (let py = Math.floor(y0 * scale); py < Math.min(img.height, Math.ceil(y1 * scale)); py++) {
    for (let px = 0; px < img.width; px++) max = Math.max(max, img.data[(py * img.width + px) * 4]);
  }
  return max;
}

beforeAll(async () => {
  await registerFont(FAMILY, {}, metricsUrl, atlasUrl);
  registerFontOutlines(FAMILY, {}, ttfUrl);
  for (let i = 0; i < 100 && outlineStatus(FAMILY) !== 'ready'; i++) {
    render('visible', OUTLINE_SCALE);
    await new Promise((r) => setTimeout(r, 20));
  }
  expect(outlineStatus(FAMILY)).toBe('ready');
});

describe('a text node that clips', () => {
  for (const [tier, scale] of [['distance-field', SDF_SCALE], ['outline', OUTLINE_SCALE]] as const) {
    it(`draws no ink below its box on the ${tier} tier, and the lines inside it`, () => {
      const below = POSE.y + POSE.height + 1;
      // The premise: unclipped, the lines that overflow put ink below the box.
      expect(inkIn(render('visible', scale), scale, below, SOURCE.height)).toBeGreaterThan(200);
      const clipped = render('clip', scale);
      expect(inkIn(clipped, scale, below, SOURCE.height)).toBe(0);
      expect(inkIn(clipped, scale, POSE.y, POSE.y + POSE.height)).toBeGreaterThan(200);
    });
  }
});
