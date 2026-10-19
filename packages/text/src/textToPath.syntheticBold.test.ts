/**
 * Synthetic bold through `textToPath`: Inter's real atlas registered at 400
 * only, so 700 is faked from it, with Inter's real outlines behind it. The
 * renderer draws the fake by dropping the field threshold
 * (`SYNTH_BOLD_AMOUNT`), so the outline has to grow by the distance that
 * moves the edge in that atlas.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  registerFont,
  registerFontOutlines,
  loadFontOutlines,
  SYNTH_BOLD_AMOUNT,
  type ResolveResult,
} from '@weasel-js/font';
import { _resetFontRegistryForTests, _resetFontOutlinesForTests } from '@weasel-js/font/test-seams';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { boundsOfPath, pathToCubicContours, pointInPath, PATH_C, PATH_Q, type PolygonPath } from '@weasel-js/geom';
import { textToPath, textToPathsByPaint } from './textToPath';
import { syntheticBoldOffset } from './syntheticBold';

const INTER = resolve(import.meta.dirname, '../../../assets/fonts/inter');
const METRICS = JSON.parse(readFileSync(`${INTER}/inter.json`, 'utf8'));
const POSE = { x: 10, y: 20, width: 4000, height: 2000 };
const SIZE = 1000;

/** The growth per side, in em, read off the atlas file the way the shader reads it. */
const ATLAS_GROWTH = (SYNTH_BOLD_AMOUNT * METRICS.distanceField.distanceRange) / METRICS.info.size;

beforeEach(async () => {
  _resetFontRegistryForTests();
  _resetFontOutlinesForTests();
  _resetLayoutCacheForTests();
  global.fetch = vi.fn().mockImplementation((url: string) =>
    url.endsWith('.json')
      ? Promise.resolve({ ok: true, json: () => Promise.resolve(METRICS) })
      : Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(['PNG'])),
        }),
  ) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({
    width: 512,
    height: 256,
    close: vi.fn(),
  } as unknown as ImageBitmap);
  await registerFont('faux', { weight: 400 }, '/faux.json', '/faux.png');
  registerFontOutlines('faux', { weight: 400 }, new Uint8Array(readFileSync(`${INTER}/inter.ttf`)).buffer);
  await loadFontOutlines('faux', { weight: 400 });
});

const outline = (text: string, fontWeight: number): PolygonPath =>
  textToPath({ text, style: { fontFamily: 'faux', fontSize: SIZE, fontWeight } }, POSE);

function resolvedAs(source: ResolveResult['source'], bold: boolean): ResolveResult {
  return {
    entry: null,
    source,
    resolved: { family: 'faux', weight: 400, style: 'normal' },
    synthetic: { bold, italic: false },
  };
}

describe('textToPath — synthetic bold', () => {
  it('grows each stem by the field shift on either side', () => {
    expect(ATLAS_GROWTH).toBeCloseTo(0.01, 6);
    for (const ch of ['I', 'l']) {
      const regular = boundsOfPath(outline(ch, 400));
      const bold = boundsOfPath(outline(ch, 700));
      expect(bold.width - regular.width).toBeCloseTo(2 * ATLAS_GROWTH * SIZE, 1);
      expect(bold.height - regular.height).toBeCloseTo(2 * ATLAS_GROWTH * SIZE, 1);
      // Grown about the stem's own center: the pen does not move.
      expect(bold.x + bold.width / 2).toBeCloseTo(regular.x + regular.width / 2, 1);
    }
  });

  it('turns a square corner in a miter, as the MSDF shift does', () => {
    const regular = boundsOfPath(outline('I', 400));
    const path = outline('I', 700);
    const g = ATLAS_GROWTH * SIZE;
    // The grown corner's tip: inside under a miter, outside under a round join.
    expect(pointInPath(path, regular.x - g + 0.5, regular.y - g + 0.5)).toBe(true);
  });

  it('shrinks a counter rather than filling it', () => {
    const path = outline('O', 700);
    const b = boundsOfPath(path);
    expect(pointInPath(path, b.x + b.width / 2, b.y + b.height / 2)).toBe(false);
  });

  it('keeps every curve a curve', () => {
    const regular = outline('Hamburgefonstiv', 400);
    const bold = outline('Hamburgefonstiv', 700);
    const curves = (p: PolygonPath) => Array.from(p.commands).filter((c) => c === PATH_C || c === PATH_Q).length;
    expect(curves(bold)).toBeGreaterThanOrEqual(curves(regular));
    // What the growth costs in anchors: 374 commands regular, 414 emboldened, measured 2026-10-18.
    expect(bold.commands.length, `${regular.commands.length} → ${bold.commands.length}`)
      .toBeLessThanOrEqual(regular.commands.length * 1.15);
  });

  it('outlines only the edge, so a stroke draws nothing inside the glyph', () => {
    // Glyphs whose grown parts overlap, or loop at an inside corner, when grown alone.
    const path = outline('bdk1@8', 700);
    const e = 0.5;
    const inside: string[] = [];
    for (const { segs } of pathToCubicContours(path)) {
      for (const { c } of segs) {
        const x = (c[0] + 3 * c[2] + 3 * c[4] + c[6]) / 8,
          y = (c[1] + 3 * c[3] + 3 * c[5] + c[7]) / 8;
        const dx = c[6] + c[4] - c[2] - c[0],
          dy = c[7] + c[5] - c[3] - c[1];
        const l = Math.hypot(dx, dy);
        if (l === 0) continue;
        const [nx, ny] = [(dy / l) * e, (-dx / l) * e];
        const filled = (px: number, py: number) => pointInPath(path, px, py, { tolerance: 0.01 });
        if (filled(x + nx, y + ny) && filled(x - nx, y - ny)) inside.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
    }
    expect(inside, 'edges with fill on both sides').toEqual([]);
  });

  it('splits by paint without refusing', () => {
    const groups = textToPathsByPaint(
      {
        text: 'Hi',
        style: { fontFamily: 'faux', fontSize: SIZE, fontWeight: 700 },
      },
      POSE,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.path.commands.length).toBeGreaterThan(0);
  });

  it('leaves a real weight alone', () => {
    const a = boundsOfPath(outline('I', 400));
    const b = boundsOfPath(outline('I', 500));
    expect(b.width).toBeCloseTo(a.width, 3);
  });
});

describe('syntheticBoldOffset — per tier', () => {
  it('grows an atlas glyph by distanceRange texels of shift over the atlas size, mitered', () => {
    const o = syntheticBoldOffset(resolvedAs('atlas', true))!;
    expect(o.growth).toBeCloseTo(ATLAS_GROWTH, 12);
    expect(o.join).toBe('miter');
  });

  it('grows a canvas glyph by SDF_RADIUS texels of shift over the bake size, rounded', () => {
    const o = syntheticBoldOffset(resolvedAs('canvas', true))!;
    expect(o.growth).toBeCloseTo((SYNTH_BOLD_AMOUNT * 8) / 48, 12);
    expect(o.join).toBe('round');
  });

  it('does not grow what the renderer draws unshifted', () => {
    expect(syntheticBoldOffset(resolvedAs('atlas', false))).toBeNull();
    // The outline tier paints geometry, which has no threshold to shift.
    expect(syntheticBoldOffset(resolvedAs('outline', true))).toBeNull();
  });
});
