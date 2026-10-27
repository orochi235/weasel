/**
 * A turned run's glyphs reach the batch turned about their pens: atlas quads
 * through `pushGlyph`, outline glyphs through their merged mesh, and the
 * painted bounds grow to hold them.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { mat3 } from '@weasel-js/geom';
import type { LaidOutGroup } from '@weasel-js/text';
import { dispatch } from './draw';
import { FLOATS_PER_VERTEX } from './drawBatch';
import type { TextDrawCommand } from './DrawCommand';
import { outlineGroupMesh } from './glyphOutlineMesh';
import { textBox } from './textBounds';
import { createRecorderCtx, stagedVertices } from './testing/recorderCtx';

const command = (rotate?: number): TextDrawCommand => ({
  kind: 'text', x: 0, y: 0,
  runs: [{
    text: 'A', fontFamily: 'inter', fontSize: 16, fontWeight: 400,
    fontStyle: 'normal', fill: { paint: { kind: 'solid', color: '#000' } },
    letterSpacing: 0,
    underline: false, strikethrough: false, overline: false, baselineShift: 0,
    ...(rotate ? { rotate } : {}),
  }],
  maxWidth: Infinity, align: 'left', style: {},
});

/** The first staged quad's corners, top left round to bottom left. */
function stagedCorners(cmd: TextDrawCommand): [number, number][] {
  const { ctx, calls } = createRecorderCtx();
  dispatch(ctx, cmd);
  const v = stagedVertices(ctx, calls);
  return [0, 1, 2, 3].map((k) => [v[k * FLOATS_PER_VERTEX], v[k * FLOATS_PER_VERTEX + 1]]);
}

beforeEach(async () => {
  const encoder = new TextEncoder();
  global.fetch = vi.fn().mockImplementation((url: string) => (url.endsWith('.json')
    ? Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) })
    : Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })) })),
  ) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({ width: 512, height: 512, close: vi.fn() } as unknown as ImageBitmap);
  _resetFontRegistryForTests();
  await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
});

describe('drawing turned glyphs', () => {
  it('stages an atlas quad turned a quarter clockwise: its top edge runs down', () => {
    const [a, b] = stagedCorners(command());
    const [ta, tb, tc] = stagedCorners(command(90));
    const width = b[0] - a[0];
    expect(width).toBeGreaterThan(0);
    expect(tb[0] - ta[0]).toBeCloseTo(0, 6);
    expect(tb[1] - ta[1]).toBeCloseTo(width, 6);
    // The quad's height now runs toward -x, from its top edge to its bottom.
    expect(tc[0]).toBeLessThan(tb[0]);
  });

  it('grows the painted bounds below the baseline for a glyph turned upside down', () => {
    const m = mat3.identity();
    const upright = textBox(command(), m)!;
    const turned = textBox(command(180), m)!;
    expect(turned.maxY).toBeGreaterThan(upright.maxY);
    expect(turned.minX).toBeLessThan(upright.minX);
  });

  it('turns an outline glyph\'s mesh about its pen', () => {
    const group = {
      family: 'squares', weight: 400, style: 'normal', synthetic: { bold: false, italic: false },
      source: 'outline', page: 0, fill: null, quadData: [], quads: [],
      glyphs: [{ d: 'M0 -0.5L0.5 -0.5L0.5 0L0 0Z', key: 'rotate-test-square', x: 10, baselineY: 20, scale: 100, rotate: 90 }],
    } as unknown as LaidOutGroup;
    const mesh = outlineGroupMesh(group, 0, 0)!;
    const xs: number[] = [], ys: number[] = [];
    for (let k = 0; k < mesh.vertices.length; k += 2) { xs.push(mesh.vertices[k]); ys.push(mesh.vertices[k + 1]); }
    expect(Math.min(...xs)).toBeCloseTo(10, 6);
    expect(Math.max(...xs)).toBeCloseTo(60, 6);
    expect(Math.min(...ys)).toBeCloseTo(20, 6);
    expect(Math.max(...ys)).toBeCloseTo(70, 6);
  });
});
