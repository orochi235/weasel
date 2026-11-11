/**
 * Property tests of the `.lbx` writer at its edges and across tapes: pages whose coordinates, group transforms,
 * and stroke widths reach past the double range, to `NaN`, and to the subnormals are written with every number
 * finite and read back as written, and a length that is not a positive finite number is refused; the same
 * commands written to every tape read back as the same objects on that tape's paper; and `sliceAtCuts` keeps
 * every row of the raster, in order, cut at each distinct dot inside it.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { parseLbx } from 'bil-lbx';
import { mat3 } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { sliceAtCuts } from '../print';
import { TAPES } from '../tape';
import { finiteDeep, objectCommand, runs, shape, tape, timeoutFor } from '../pbt.fixture';
import { writeLbx } from './writeLbx';
import { lbxObjects } from './carried';

const edge = fc.oneof(
  fc.constantFrom(0, -0, 1e308, -1e308, 1e200, Number.MIN_VALUE, -5e-324, 2 ** 53 + 1, Number.NaN, Infinity, -Infinity),
  fc.double({ min: -1e3, max: 1e3, noNaN: true }),
);
const width = fc.oneof(fc.constantFrom(0, -1, 1e308, Infinity, Number.NaN, Number.MIN_VALUE), fc.double({ min: 0.01, max: 20, noNaN: true }));

const edgeRect: fc.Arbitrary<DrawCommand> = fc.record({ x: edge, y: edge, w: edge, h: edge, stroke: fc.option(width, { nil: undefined }) })
  .map(({ x, y, w, h, stroke }) => ({
    kind: 'path', path: { kind: 'rect', x, y, width: w, height: h }, fill: { paint: { color: '#000000' } },
    ...(stroke !== undefined ? { stroke: { paint: { color: '#000000' }, width: stroke } } : {}),
  }));
const edgeGroup = (children: fc.Arbitrary<DrawCommand[]>): fc.Arbitrary<DrawCommand> =>
  fc.record({ s: fc.oneof(edge, fc.constant(1)), tx: edge, ty: edge, children })
    .map(({ s, tx, ty, children }) => ({ kind: 'group', transform: mat3.scaled(mat3.translated(mat3.identity(), tx, ty), s, s), children }));
const carrier: fc.Arbitrary<DrawCommand> = fc.record({ x: edge, y: edge, w: edge, h: edge })
  .map(({ x, y, w, h }) => lbxObjects([{
    type: 'rect', shape: 'RECTANGLE', position: { x, y, width: w, height: h },
    pen: { style: 'NULL' }, brush: { style: 'SOLID', color: '#000000' },
  }]));
const edgeCommand = fc.oneof(edgeRect, carrier, objectCommand, edgeGroup(fc.array(fc.oneof(edgeRect, carrier, objectCommand), { maxLength: 3 })));

describe('writeLbx at the edges', () => {
  it('writes every number finite and reads back what it wrote, whatever the commands hold', async () => {
    let objects = 0;
    let skipped = 0;
    await fc.assert(fc.asyncProperty(tape, fc.oneof(fc.constantFrom(1e-300, 1e308), fc.double({ min: 1, max: 3000, noNaN: true })),
      fc.array(edgeCommand, { maxLength: 5 }), async (t, length, commands) => {
        const out = await writeLbx({ length, tape: t, commands });
        expect(finiteDeep(out.config)).toBe(true);
        const back = await parseLbx(out.bytes);
        // Through JSON, where a `-0` written as a position reads back as the `0` it places.
        const plain = (v: unknown) => JSON.parse(JSON.stringify(v)) as unknown;
        expect(plain(back.objects.map(shape))).toEqual(plain(out.config.objects.map(shape)));
        objects += out.config.objects.length;
        skipped += out.skipped.length;
      }), runs(200));
    expect(objects).toBeGreaterThan(50);
    expect(skipped).toBeGreaterThan(50);
  }, timeoutFor(200, 40));

  it('refuses a length that is not a positive finite number of points', async () => {
    await fc.assert(fc.asyncProperty(tape, fc.constantFrom(0, -0, -1, -1e308, Number.NaN, Infinity, -Infinity), async (t, length) => {
      await expect(writeLbx({ length, tape: t, commands: [] })).rejects.toThrow(RangeError);
    }), runs(30));
  });
});

describe('writeLbx on every tape', () => {
  it('writes the same objects whichever tape the label is on, each read back on that tape', async () => {
    await fc.assert(fc.asyncProperty(fc.double({ min: 10, max: 2000, noNaN: true }), fc.array(objectCommand, { maxLength: 5 }),
      async (length, commands) => {
        let first: unknown;
        for (const t of TAPES) {
          const out = await writeLbx({ length, tape: t, commands });
          const back = await parseLbx(out.bytes);
          expect(back.paper).toMatchObject({ width: t.widthPt, format: t.format, height: length });
          const objects = back.objects.map(shape);
          expect(objects).toEqual(out.config.objects.map(shape));
          if (first === undefined) first = objects;
          else expect(objects).toEqual(first);
        }
      }), runs(40));
  }, timeoutFor(40, 200));
});

describe('sliceAtCuts', () => {
  it('keeps every row in order, cut at each distinct dot inside the raster', () => {
    fc.assert(fc.property(fc.nat({ max: 60 }), fc.array(fc.oneof(edge, fc.double({ min: -10, max: 80, noNaN: true })), { maxLength: 6 }),
      fc.constantFrom(72, 180, 360), (lineCount, cuts, dpi) => {
        const rows = Array.from({ length: lineCount }, (_, i) => Uint8Array.of(i));
        const pages = sliceAtCuts({ lineBytes: 1, lineCount, rows }, cuts, dpi);
        expect(pages.flatMap((p) => p.rows)).toEqual(rows);
        for (const p of pages) expect(p.lineCount).toBe(p.rows.length);
        const dots = new Set(cuts.map((x) => Math.round(x * (dpi / 72))).filter((d) => d > 0 && d < lineCount));
        expect(pages).toHaveLength(dots.size + 1);
        expect(pages.slice(0, -1).every((p) => p.lineCount > 0)).toBe(true);
      }), runs(300));
  });
});
