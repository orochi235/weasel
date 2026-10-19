/**
 * Synthetic-bold outlines against real WebGL2 and the real Inter atlas: the
 * outline `textToPath` grows, and the one the renderer's outline tier draws,
 * must each be as wide as the stem the renderer draws by dropping the field
 * threshold. The unit tests check the growth against the formula; this checks
 * the formula against the pixels.
 *
 * Inter's atlas is registered at 400 only, so 700 is faked from it. `FAMILY`
 * has outlines, so at this size its text is drawn on the outline tier;
 * `FIELD_FAMILY` is the same atlas with none, which keeps it on the field. The
 * canvas tier is not measured: it rasterizes the real weight and never
 * carries the synthetic-bold flag.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { registerFont, registerFontOutlines, loadFontOutlines, outlineStatus } from '@weasel-js/font';
import { textToPath } from '@weasel-js/text';
import type { DrawCommand } from '@weasel-js/renderer';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/composePose';
import { createRasterSession, type RasterImage } from './renderSceneToPixels';
import metricsUrl from '../../../../assets/fonts/inter/inter.json?url';
import atlasUrl from '../../../../assets/fonts/inter/inter.png?url';
import ttfUrl from '../../../../assets/fonts/inter/inter.ttf?url';

const FAMILY = 'synthetic-bold-outline-inter';
const FIELD_FAMILY = 'synthetic-bold-field-inter';
const SIZE = 400;
const POSE: RectPose = { x: 40, y: 0, width: 300, height: SIZE * 1.2 };
const SOURCE = { x: 0, y: 0, width: 240, height: SIZE * 1.2 };
/** How far a measured stem may differ from the outline's, in pixels. The
 *  outline grows each stem by 8px at this size (0.01 em a side). */
const TOLERANCE_PX = 1;

const session = createRasterSession();
afterAll(() => session.dispose());

const source = (fontWeight: number, fontFamily = FAMILY) => ({
  text: 'I',
  style: { fontFamily, fontSize: SIZE, fontWeight, lineHeight: 1.2 },
});

function renderText(fontWeight: number, fontFamily: string): RasterImage {
  const scene = createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
  });
  scene.add({
    kind: 'leaf',
    layer: 'main',
    pose: { ...POSE },
    data: {
      ...source(fontWeight, fontFamily),
      fill: { paint: { kind: 'solid', color: '#ffffff' } },
    },
  });
  return session.render({
    scene,
    sourceRect: SOURCE,
    scale: { x: 1, y: 1 },
    background: '#000000',
  });
}

function renderOutline(fontWeight: number): RasterImage {
  const cmd: DrawCommand = {
    kind: 'path',
    path: textToPath(source(fontWeight), POSE),
    fill: { paint: { color: '#ffffff' } },
  };
  const scene = createScene<{ cmd: DrawCommand }, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
  });
  scene.add({
    kind: 'leaf',
    layer: 'main',
    pose: { ...SOURCE },
    data: { cmd },
  });
  return session.render({
    scene,
    sourceRect: SOURCE,
    scale: { x: 1, y: 1 },
    background: '#000000',
    drawOne: (node) => [(node.data as { cmd: DrawCommand }).cmd],
  });
}

const ink = (img: RasterImage, x: number, y: number) => img.data[(y * img.width + x) * 4] / 255;

/** The stem across the middle rows of its ink: its width as ink summed along
 *  each row, and its left edge to a fraction of a pixel. */
function stem(img: RasterImage): { width: number; left: number } {
  let top = img.height,
    bottom = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (ink(img, x, y) > 0.5) {
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        break;
      }
    }
  }
  expect(bottom - top, 'the stem is drawn').toBeGreaterThan(SIZE / 2);
  let width = 0,
    left = 0,
    rows = 0;
  for (let y = Math.round(top + (bottom - top) * 0.3); y <= Math.round(top + (bottom - top) * 0.7); y++) {
    let sum = 0,
      first = -1;
    for (let x = 0; x < img.width; x++) {
      const v = ink(img, x, y);
      if (first < 0 && v > 0.01) first = x;
      sum += v;
    }
    width += sum;
    left += first + (1 - ink(img, first, y));
    rows++;
  }
  return { width: width / rows, left: left / rows };
}

beforeAll(async () => {
  await registerFont(FAMILY, { weight: 400 }, metricsUrl, atlasUrl);
  await registerFont(FIELD_FAMILY, { weight: 400 }, metricsUrl, atlasUrl);
  registerFontOutlines(FAMILY, { weight: 400 }, ttfUrl);
  await loadFontOutlines(FAMILY, { weight: 400 });
  expect(outlineStatus(FAMILY, 400, 'normal')).toBe('ready');
});

describe('synthetic-bold outlines', () => {
  it('outlines each stem as wide as the field shift draws it', () => {
    const drawn = stem(renderText(700, FIELD_FAMILY));
    const outlined = stem(renderOutline(700));
    const regular = stem(renderOutline(400));
    const report =
      `drawn ${drawn.width.toFixed(2)}px at ${drawn.left.toFixed(2)}, outlined ` +
      `${outlined.width.toFixed(2)}px at ${outlined.left.toFixed(2)}, regular ${regular.width.toFixed(2)}px`;
    expect(outlined.width - regular.width, report).toBeCloseTo(8, 0);
    expect(Math.abs(outlined.width - drawn.width), report).toBeLessThanOrEqual(TOLERANCE_PX);
    expect(Math.abs(outlined.left - drawn.left), report).toBeLessThanOrEqual(TOLERANCE_PX / 2);
  });

  it('draws each stem on the outline tier as wide as the field shift draws it', () => {
    const field = renderText(700, FIELD_FAMILY);
    const tierImage = renderText(700, FAMILY);
    // A proxy for the tier having drawn it: the same atlas at the same place
    // would come back byte for byte.
    expect(tierImage.data.every((v, i) => v === field.data[i]), 'drawn on the outline tier').toBe(false);
    const drawn = stem(field);
    const tier = stem(tierImage);
    const regular = stem(renderText(400, FAMILY));
    const report =
      `field ${drawn.width.toFixed(2)}px at ${drawn.left.toFixed(2)}, outline tier ` +
      `${tier.width.toFixed(2)}px at ${tier.left.toFixed(2)}, regular ${regular.width.toFixed(2)}px`;
    expect(tier.width - regular.width, report).toBeCloseTo(8, 0);
    expect(Math.abs(tier.width - drawn.width), report).toBeLessThanOrEqual(TOLERANCE_PX);
    expect(Math.abs(tier.left - drawn.left), report).toBeLessThanOrEqual(TOLERANCE_PX / 2);
  });
});
