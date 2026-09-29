/**
 * Texture paints on text, against real WebGL2 and the real Inter files.
 *
 * Text below `OUTLINE_MIN_SCREEN_PX` draws off the distance-field atlas and
 * text above it draws as tessellated outlines, so the same node changes tier
 * as the view zooms. A paint is measured in world space either way, which is
 * what the tier checks pin: the same world point reads the same color on
 * either side of the threshold.
 *
 * The batch checks are pixel probes rather than a baseline because a
 * screenshot cannot see which draw a pixel came from — see the batch trap in
 * the repo's CLAUDE.md.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { registerFont, registerFontOutlines, outlineStatus } from '@weasel-js/font';
import type { FillStyle } from '@weasel-js/paint';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'features/groups/composePose';
import { resolveFillPattern } from 'features/patterns/resolveSpec';
import { renderSceneToPixels, type RasterImage } from './renderSceneToPixels';
import type { DrawCommand } from '../renderer/DrawCommand';
import { OUTLINE_MIN_SCREEN_PX } from '../renderer/draw';
import metricsUrl from '../../../../assets/fonts/inter/inter.json?url';
import atlasUrl from '../../../../assets/fonts/inter/inter.png?url';
import ttfUrl from '../../../../assets/fonts/inter/inter.ttf?url';

const FAMILY = 'paint-inter';
const FONT_SIZE = 32;
const TEXT = 'HMWH';
const POSE: RectPose = { x: 4, y: 4, width: 104, height: 44 };
const SOURCE = { x: 0, y: 0, width: 112, height: 52 };

/** Scales either side of the threshold, close enough that the glyphs barely
 *  change size on screen. */
const SDF_SCALE = (OUTLINE_MIN_SCREEN_PX / FONT_SIZE) * 0.92;
const OUTLINE_SCALE = (OUTLINE_MIN_SCREEN_PX / FONT_SIZE) * 1.08;

interface TextData { text: string; style: object; fill: FillStyle }

function renderNode(fill: FillStyle, scale: number): RasterImage {
  const scene = createScene<TextData, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({
    kind: 'leaf', layer: 'main', pose: POSE,
    data: { text: TEXT, style: { fontFamily: FAMILY, fontSize: FONT_SIZE }, fill },
  });
  return renderSceneToPixels({ scene, sourceRect: SOURCE, scale: { x: scale, y: scale } });
}

function renderCommands(commands: DrawCommand[], scale = 1): RasterImage {
  const scene = createScene<null, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ kind: 'leaf', layer: 'main', pose: POSE, data: null });
  return renderSceneToPixels({
    scene,
    drawOne: (() => commands) as never,
    sourceRect: SOURCE,
    scale: { x: scale, y: scale },
    background: '#000000',
  });
}

function pixelAt(img: RasterImage, wx: number, wy: number, scale: number): number[] {
  const px = Math.min(img.width - 1, Math.floor(wx * scale));
  const py = Math.min(img.height - 1, Math.floor(wy * scale));
  const i = (py * img.width + px) * 4;
  return Array.from(img.data.subarray(i, i + 4));
}

/** World points, on a half-unit grid, that both renders cover with solid ink —
 *  well inside a glyph, where the two tiers' edges cannot differ. */
function sharedInk(a: RasterImage, sa: number, b: RasterImage, sb: number): [number, number][] {
  const out: [number, number][] = [];
  for (let wy = POSE.y; wy < POSE.y + POSE.height; wy += 0.5) {
    for (let wx = POSE.x; wx < POSE.x + POSE.width; wx += 0.5) {
      if (pixelAt(a, wx, wy, sa)[3] >= 250 && pixelAt(b, wx, wy, sb)[3] >= 250) out.push([wx, wy]);
    }
  }
  return out;
}

function rgbDistance(p: number[], q: number[]): number {
  return Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2]));
}

/** Red on the left of the box, blue on the right, in the box's own units —
 *  what the paint panel writes. */
const GRADIENT: FillStyle = {
  fill: 'linear-gradient',
  from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
  stops: [{ offset: 0, color: '#ff0000ff' }, { offset: 1, color: '#0000ffff' }],
  units: 'bounds',
};

/** Wide white stripes on a transparent ground, in the box's units. */
const PATTERN: FillStyle = {
  fill: 'pattern',
  pattern: { tile: 'hatch', color: '#ffffff', size: 16, lineWidth: 6 },
  units: 'bounds',
};

async function loadOutlines(): Promise<void> {
  // Outlines load on first use, so a render is what starts the fetch.
  for (let i = 0; i < 100 && outlineStatus(FAMILY) !== 'ready'; i++) {
    renderNode({ fill: 'solid', color: '#ffffff' }, OUTLINE_SCALE);
    await new Promise((r) => setTimeout(r, 20));
  }
  expect(outlineStatus(FAMILY)).toBe('ready');
}

beforeAll(async () => {
  await registerFont(FAMILY, {}, metricsUrl, atlasUrl);
  registerFontOutlines(FAMILY, {}, ttfUrl);
  await loadOutlines();
});

describe('a gradient on text', () => {
  it('paints the ramp on atlas-tier text, red on the left and blue on the right', () => {
    const img = renderNode(GRADIENT, SDF_SCALE);
    const ink = sharedInk(img, SDF_SCALE, img, SDF_SCALE);
    expect(ink.length).toBeGreaterThan(100);
    const left = ink.filter(([x]) => x < POSE.x + POSE.width * 0.2).map(([x, y]) => pixelAt(img, x, y, SDF_SCALE));
    const right = ink.filter(([x]) => x > POSE.x + POSE.width * 0.8).map(([x, y]) => pixelAt(img, x, y, SDF_SCALE));
    expect(left.length).toBeGreaterThan(10);
    expect(right.length).toBeGreaterThan(10);
    for (const p of left) expect(p[0]).toBeGreaterThan(p[2] + 64);
    for (const p of right) expect(p[2]).toBeGreaterThan(p[0] + 64);
  });

  it('reads the same color at the same world point on either side of the threshold', () => {
    const sdf = renderNode(GRADIENT, SDF_SCALE);
    const outline = renderNode(GRADIENT, OUTLINE_SCALE);
    const ink = sharedInk(sdf, SDF_SCALE, outline, OUTLINE_SCALE);
    expect(ink.length).toBeGreaterThan(100);
    // One pixel of the two grids apart is at most a pixel of ramp, and the
    // ramp crosses 255 levels over ~150 pixels.
    const worst = Math.max(...ink.map(([x, y]) => rgbDistance(
      pixelAt(sdf, x, y, SDF_SCALE), pixelAt(outline, x, y, OUTLINE_SCALE))));
    expect(worst).toBeLessThanOrEqual(8);
  });
});

describe('a gradient on decorated text', () => {
  it('paints the underline with the ramp too', () => {
    const scene = createScene<TextData, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    scene.add({
      kind: 'leaf', layer: 'main', pose: POSE,
      data: { text: TEXT, style: { fontFamily: FAMILY, fontSize: FONT_SIZE, underline: true }, fill: GRADIENT },
    });
    const img = renderSceneToPixels({ scene, sourceRect: SOURCE, scale: { x: 1, y: 1 } });
    // The underline is the lowest row lit at both ends of the text — no glyph
    // reaches below the baseline at either.
    const inked = (x: number, y: number) => pixelAt(img, x, y + 0.5, 1)[3] >= 128;
    let row = -1;
    for (let y = img.height - 1; y >= 0 && row < 0; y--) {
      if (inked(POSE.x + 4, y) && inked(POSE.x + 80, y)) row = y;
    }
    expect(row).toBeGreaterThan(0);
    const left = pixelAt(img, POSE.x + 4, row + 0.5, 1);
    const right = pixelAt(img, POSE.x + 80, row + 0.5, 1);
    expect(left[0]).toBeGreaterThan(left[2] + 64);
    expect(right[2]).toBeGreaterThan(right[0] + 64);
  });
});

describe('a pattern on text', () => {
  it('shows the stripes on atlas-tier text rather than a flat color', () => {
    const img = renderNode(PATTERN, SDF_SCALE);
    const mask = renderNode({ fill: 'solid', color: '#ffffff' }, SDF_SCALE);
    const ink = sharedInk(mask, SDF_SCALE, mask, SDF_SCALE);
    expect(ink.length).toBeGreaterThan(100);
    const alphas = ink.map(([x, y]) => pixelAt(img, x, y, SDF_SCALE)[3]);
    // Stripes and gaps both fall inside the glyphs.
    expect(alphas.filter((a) => a >= 250).length).toBeGreaterThan(ink.length * 0.15);
    expect(alphas.filter((a) => a <= 5).length).toBeGreaterThan(ink.length * 0.15);
  });

  it('puts the stripes in the same place on either side of the threshold', () => {
    const maskSdf = renderNode({ fill: 'solid', color: '#ffffff' }, SDF_SCALE);
    const maskOutline = renderNode({ fill: 'solid', color: '#ffffff' }, OUTLINE_SCALE);
    const sdf = renderNode(PATTERN, SDF_SCALE);
    const outline = renderNode(PATTERN, OUTLINE_SCALE);
    const ink = sharedInk(maskSdf, SDF_SCALE, maskOutline, OUTLINE_SCALE);
    expect(ink.length).toBeGreaterThan(100);
    // Only a stripe's own antialiased edge may disagree.
    const agree = ink.filter(([x, y]) => Math.abs(
      pixelAt(sdf, x, y, SDF_SCALE)[3] - pixelAt(outline, x, y, OUTLINE_SCALE)[3]) <= 64);
    expect(agree.length).toBeGreaterThan(ink.length * 0.9);
  });
});

describe('texture-painted atlas text in a batched frame', () => {
  const run = (text: string, fill: FillStyle) => ({
    text, fontFamily: FAMILY, fontSize: FONT_SIZE, fontWeight: 400, fontStyle: 'normal',
    fill, letterSpacing: 0, underline: false, strikethrough: false, overline: false, baselineShift: 0,
  });
  const WORLD_STRIPES = resolveFillPattern({
    fill: 'pattern',
    pattern: { tile: 'hatch', color: '#ffffff', size: 16, lineWidth: 6 },
    units: 'world',
  })!;

  it('draws in painter order between staged solids, and leaves solid text beside it solid', () => {
    const commands: DrawCommand[] = [
      // Under the text: staged before it, so its run has to drain first.
      { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 112, height: 52 }, fill: { color: '#ff0000' } },
      {
        kind: 'text', x: 4, y: 4, align: 'left', style: { fontFamily: FAMILY, fontSize: FONT_SIZE },
        runs: [run('HH', WORLD_STRIPES), run('HH', { fill: 'solid', color: '#ffff00' })],
      } as DrawCommand,
      // Over the right half of the text: staged after it, so it must land on top.
      { kind: 'path', path: { kind: 'rect', x: 84, y: 0, width: 28, height: 52 }, fill: { color: '#00ff00' } },
    ];
    const img = renderCommands(commands);
    const mask = renderCommands([
      { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 112, height: 52 }, fill: { color: '#000000' } },
      {
        kind: 'text', x: 4, y: 4, align: 'left', style: { fontFamily: FAMILY, fontSize: FONT_SIZE },
        runs: [run('HH', { color: '#ffffff' }), run('HH', { color: '#ffffff' })],
      } as DrawCommand,
    ]);
    const px = (x: number, y: number) => pixelAt(img, x + 0.5, y + 0.5, 1);
    const inMask = (x: number, y: number) => pixelAt(mask, x + 0.5, y + 0.5, 1)[0] >= 250;

    // Outside any glyph the red ground shows: the run holding it was drawn.
    expect(px(1, 1)).toEqual([255, 0, 0, 255]);

    let white = 0, red = 0, yellow = 0, other = 0, greenOver = 0;
    for (let y = 0; y < 52; y++) {
      for (let x = 0; x < 112; x++) {
        if (!inMask(x, y)) continue;
        const p = px(x, y);
        if (x >= 84) { if (p[0] === 0 && p[1] === 255 && p[2] === 0) greenOver++; else other++; continue; }
        if (p[0] === 255 && p[1] === 255 && p[2] === 255) white++;
        else if (p[0] === 255 && p[1] === 0 && p[2] === 0) red++;
        else if (p[0] === 255 && p[1] === 255 && p[2] === 0) yellow++;
      }
    }
    // The patterned run: stripes over the ground, and the ground in the gaps.
    expect(white).toBeGreaterThan(20);
    expect(red).toBeGreaterThan(20);
    // The solid run staged after it paints its own color.
    expect(yellow).toBeGreaterThan(20);
    // Everything under the last rect is the last rect.
    expect(greenOver).toBeGreaterThan(20);
    expect(other).toBe(0);
  });
});
