/**
 * Property tests of the `.lbx` writer and the tape geometry: a page of rects, polylines, and text boxes under
 * axis-aligned groups, with any text in them, is written and read back by `parseLbx` as the label `lbxConfig`
 * described, every number finite; each tape and its printable band are finite and inside the tape, and a
 * render plan lands one pixel on each printer dot.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { decodeBmp32, parseLbx, type ImageObject, type LabelObject } from 'bil-lbx';
import { PathBuilder } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { Printers } from 'obwat';
import { labelGrid, labelRenderPlan, printableBand } from '../render';
import { TAPES, tapeForWidthMm, tapeNamed } from '../tape';
import { coord, objectCommand, runs, tape, timeoutFor } from '../pbt.fixture';
import { lbxConfig, writeLbx } from './writeLbx';

/** A pen or brush that draws nothing reads back as none. */
const drawn = <T extends { style: string }>(v: T | undefined): T | undefined => (v?.style === 'NULL' ? undefined : v);

/** What of an object a P-touch round trip has to keep. */
function shape(o: LabelObject): Record<string, unknown> {
  const common = { type: o.type, position: o.position };
  switch (o.type) {
    case 'text':
      return {
        ...common, data: o.data, font: { name: o.font.name, size: o.font.size, ...(o.font.weight !== 400 && o.font.weight !== undefined ? { weight: o.font.weight } : {}), ...(o.font.italic ? { italic: true } : {}) },
        color: o.textStyle?.color ?? '#000000', underline: o.textStyle?.underline ?? 0,
        horizontalAlignment: o.horizontalAlignment ?? 'LEFT', autoLF: !!o.autoLF,
      };
    case 'rect':
      return { ...common, pen: drawn(o.pen), brush: drawn(o.brush) };
    case 'line':
      return { ...common, points: o.points, pen: drawn(o.pen), arrowBegin: o.arrowBegin, arrowEnd: o.arrowEnd };
    default:
      return common;
  }
}

const finiteDeep = (v: unknown): boolean =>
  typeof v === 'number' ? Number.isFinite(v)
  : Array.isArray(v) ? v.every(finiteDeep)
  : v !== null && typeof v === 'object' && !(v instanceof Uint8Array) ? Object.values(v).every(finiteDeep)
  : true;

describe('writeLbx read back', () => {
  it('reads back every object, the paper, and the cuts it wrote', async () => {
    const seen = new Map<string, number>();
    await fc.assert(fc.asyncProperty(
      tape, fc.double({ min: 10, max: 2000, noNaN: true }), fc.boolean(), fc.array(fc.double({ min: -50, max: 2100, noNaN: true }), { maxLength: 4 }),
      fc.array(objectCommand, { maxLength: 6 }),
      async (t, length, autoLength, cuts, commands) => {
        const page = { length, tape: t, commands, autoLength, cuts };
        const { bytes, config, skipped } = await writeLbx(page);
        expect(finiteDeep(config)).toBe(true);
        const back = await parseLbx(bytes);
        expect(back.paper).toMatchObject({ width: config.paper.width, height: config.paper.height, autoLength: config.paper.autoLength, format: config.paper.format });
        expect(back.cut?.freeCut ?? []).toEqual(config.cut?.freeCut ?? []);
        expect(back.objects.map(shape)).toEqual(config.objects.map(shape));
        for (const o of config.objects) seen.set(o.type, (seen.get(o.type) ?? 0) + 1);
        for (const s of skipped) seen.set(`skip:${s.detail}`, (seen.get(`skip:${s.detail}`) ?? 0) + 1);
        if (config.cut) seen.set('cut', (seen.get('cut') ?? 0) + 1);
      },
    ), runs(150));
    for (const k of ['text', 'rect', 'line', 'cut', 'skip:no rasterize hook for what .lbx cannot draw']) expect(seen.get(k) ?? 0, k).toBeGreaterThan(20);
  }, timeoutFor(150, 40));

  it('reads back each image a rasterizer drew, at its place and size, between the objects around it', async () => {
    let images = 0;
    const rasterize = async (_c: readonly DrawCommand[], r: { width: number; height: number }, scale: number) => {
      const width = Math.max(1, Math.round(r.width * scale));
      const height = Math.max(1, Math.round(r.height * scale));
      const data = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < Math.min(width * height, 7); i++) data[i * 4 + 3] = 255;
      return { width, height, data };
    };
    const ellipse: fc.Arbitrary<DrawCommand> = fc.tuple(coord, coord).map(([cx, cy]) => ({
      kind: 'path', path: new PathBuilder().moveTo(cx, cy).curveTo(cx + 3, cy, cx + 3, cy + 2, cx, cy + 2).close().build(),
      fill: { paint: { color: '#000' } },
    }));
    await fc.assert(fc.asyncProperty(tape, fc.array(fc.oneof(objectCommand, ellipse), { minLength: 1, maxLength: 5 }), async (t, commands) => {
      const page = { length: 72, tape: t, commands };
      const { bytes, config } = await writeLbx(page, { rasterize, rasterDpi: 72 });
      const back = await parseLbx(bytes);
      expect(back.objects.map(shape)).toEqual(config.objects.map(shape));
      config.objects.forEach((o, i) => {
        if (o.type !== 'image') return;
        images++;
        const got = back.objects[i] as ImageObject;
        expect(decodeBmp32(got.imageData)).toEqual(decodeBmp32(o.imageData));
      });
    }), runs(80));
    expect(images).toBeGreaterThan(20);
  }, timeoutFor(80, 40));

  it('writes the same label config it reports from lbxConfig', async () => {
    await fc.assert(fc.asyncProperty(tape, fc.array(objectCommand, { maxLength: 4 }), async (t, commands) => {
      const page = { length: 144, tape: t, commands };
      expect((await writeLbx(page)).config).toEqual((await lbxConfig(page)).config);
    }), runs(60));
  }, timeoutFor(60, 20));
});

describe('tapes and the printable band', () => {
  it('names each tape once, by width and name, with finite sizes', () => {
    expect(new Set(TAPES.map((t) => t.widthMm)).size).toBe(TAPES.length);
    for (const t of TAPES) {
      expect(tapeForWidthMm(t.widthMm)).toBe(t);
      expect(tapeNamed(t.name)).toBe(t);
      expect(Number.isFinite(t.widthMm) && t.widthMm > 0).toBe(true);
      expect(Number.isFinite(t.widthPt) && t.widthPt > 0).toBe(true);
      expect(Math.abs(t.widthPt - (t.widthMm * 72) / 25.4)).toBeLessThan(1);
    }
  });

  it('keeps the band inside the tape, and renders one pixel a dot', () => {
    fc.assert(fc.property(tape, fc.double({ min: 0.01, max: 5000, noNaN: true }), coord, coord, (t, length, x, y) => {
      const media = Printers.ptP710bt.media(t.widthMm);
      const band = printableBand(t, media);
      expect(band.y).toBeGreaterThanOrEqual(0);
      expect(band.y + band.height).toBeLessThanOrEqual(t.widthPt + 1e-9);
      const plan = labelRenderPlan({ length, tape: t, media, origin: { x, y } });
      expect(finiteDeep(plan)).toBe(true);
      expect(plan.sourceRect.height * plan.scale.y).toBeCloseTo(media.printableDots, 9);
      expect(plan.sourceRect.width * plan.scale.x).toBeCloseTo((length * media.dpi) / 72, 6);
      const grid = labelGrid({ tape: t, media, origin: { x, y } });
      expect(grid.pitch * plan.scale.x).toBeCloseTo(1, 12);
      expect(grid.origin.y).toBe(plan.sourceRect.y);
      expect(grid.origin.x).toBe(plan.sourceRect.x);
    }), runs(300));
  }, timeoutFor(300, 1));
});

describe('shrunk counterexamples', () => {
  const t = tapeForWidthMm(3.5)!;
  const text = (data: string, fontFamily = 'Helvetica'): DrawCommand => ({
    kind: 'text', x: 0, y: 0, width: 10, height: 10, style: {}, align: 'left', verticalAlign: 'top',
    runs: [{
      text: data, fontFamily, fontSize: 1, fontWeight: 400, fontStyle: 'normal', fill: { paint: { color: '#000000' } },
      letterSpacing: 0, underline: false, strikethrough: false, overline: false, baselineShift: 0,
    }],
  } as DrawCommand);

  it('writes each hard break as one line feed, and reads it back', async () => {
    const { bytes, config } = await writeLbx({ length: 10, tape: t, commands: [text('a\r\nb\rc d')] });
    expect(config.objects).toMatchObject([{ type: 'text', data: 'a\nb\nc\nd' }]);
    expect((await parseLbx(bytes)).objects).toMatchObject([{ type: 'text', data: 'a\nb\nc\nd' }]);
  });

  it('draws text XML cannot carry, or a font named with a break, rather than writing it changed', async () => {
    for (const cmd of [text('a\u0001'), text('\ud800'), text('', '\r\n')]) {
      const { config, skipped } = await writeLbx({ length: 10, tape: t, commands: [cmd] });
      expect(config.objects).toEqual([]);
      expect(skipped).toEqual([{ kind: 'text', detail: 'no rasterize hook for what .lbx cannot draw' }]);
    }
  });
});
