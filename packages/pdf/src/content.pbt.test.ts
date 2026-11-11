/**
 * Property test of the precision a content stream writes numbers at: a rect, and a gradient's axis,
 * inside groups scaled far up or far down land, through every `cm` the stream writes, where their
 * transforms put them on the page.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { mat3 } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { checkPdf } from './pdfCheck.fixture';
import { runs, tally, timeoutFor } from './pbt.fixture';
import { type Dict, isDict, type Name, readContent, type Ref } from './pdfReader.fixture';
import { NO_FONTS } from './testing/noFonts';
import { writePdf } from './writePdf';

const RUNS = 200;

type Affine = [number, number, number, number, number, number];
const mul = (m: Affine, n: Affine): Affine => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m: Affine, x: number, y: number) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]] as const;

const decade = fc.integer({ min: -7, max: 7 }).chain((e) => fc.double({ min: 1, max: 9.99, noNaN: true }).map((m) => m * 10 ** e));
/** A turn and a scale of any decade, each axis within ten times the other, as the writer stores it. */
const scaled: fc.Arbitrary<Affine> = fc
  .tuple(fc.double({ min: -Math.PI, max: Math.PI, noNaN: true }), decade, fc.double({ min: 0.1, max: 10, noNaN: true }), fc.double({ min: -50, max: 50, noNaN: true }), fc.double({ min: -50, max: 50, noNaN: true }))
  .map(([a, s, k, e, f]) => mat3.toAffine(mat3.fromAffine([Math.cos(a) * s, Math.sin(a) * s, -Math.sin(a) * s * k, Math.cos(a) * s * k, e, f])) as Affine);

describe('ContentStream precision', () => {
  it('puts a rect where its transforms do, however far they scale', async () => {
    const seen = tally();
    await fc.assert(
      fc.asyncProperty(fc.array(scaled, { minLength: 1, maxLength: 3 }), fc.double({ min: 0, max: 1, noNaN: true }), fc.boolean(), async (chain, u, shaded) => {
        let total: Affine = [1, 0, 0, 1, 0, 0];
        for (const m of chain) total = mul(total, m);
        // A rect at half the page through the whole chain, in the innermost group's units.
        const det = total[0] * total[3] - total[1] * total[2];
        const inv: Affine = [total[3] / det, -total[1] / det, -total[2] / det, total[0] / det, 0, 0];
        inv[4] = -(inv[0] * total[4] + inv[2] * total[5]);
        inv[5] = -(inv[1] * total[4] + inv[3] * total[5]);
        const [x, y] = apply(inv, 20 + 60 * u, 40);
        const [x2, y2] = apply(inv, 80, 70);
        // A gradient in local units runs corner to corner, so its axis lands where the rect does.
        const fill = shaded
          ? { kind: 'linear-gradient' as const, from: { x, y }, to: { x: x2, y: y2 }, units: 'local' as const, stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }] }
          : { color: '#000' };
        const leaf: DrawCommand = { kind: 'path', path: { kind: 'rect', x, y, width: x2 - x, height: y2 - y }, fill: { paint: fill } };
        let cmd: DrawCommand = leaf;
        for (const m of [...chain].reverse()) cmd = { kind: 'group', transform: mat3.fromAffine(m), children: [cmd] };
        const { bytes } = await writePdf([{ width: 100, height: 100, commands: [cmd] }], { fonts: NO_FONTS, compress: false });
        const { pdf } = checkPdf(bytes);
        const page = [...pdf.objects.values()].find((o) => isDict(o.value) && (o.value.Type as Name | undefined)?.value === 'Page')!.value as Dict;
        const content = readContent(pdf.objects.get((page.Contents as Ref).id)!.stream!.data);
        const shadings = (page.Resources as Dict).Shading as Dict | undefined;
        let ctm: Affine = [1, 0, 0, 1, 0, 0];
        const stack: Affine[] = [];
        let corners: (readonly [number, number])[] = [];
        let axis: (readonly [number, number])[] = [];
        for (const { op, args } of content) {
          if (op === 'q') stack.push(ctm);
          else if (op === 'Q') ctm = stack.pop()!;
          else if (op === 'cm') ctm = mul(ctm, args as Affine);
          else if (op === 're') {
            const [rx, ry, rw, rh] = args as number[];
            corners = [apply(ctm, rx!, ry!), apply(ctm, rx! + rw!, ry! + rh!)];
          } else if (op === 'sh') {
            const sh = pdf.objects.get((shadings![(args[0] as Name).value] as Ref).id)!.value as Dict;
            const [ax, ay, bx, by] = sh.Coords as number[];
            axis = [apply(ctm, ax!, ay!), apply(ctm, bx!, by!)];
          }
        }
        // The page flip: y down from the top.
        const want = [[20 + 60 * u, 100 - 40], [80, 100 - 70]];
        expect(corners).toHaveLength(2);
        // Each matrix keeps four decimals of its axes, as one at unit scale always has: about 1e-4 of the
        // page per matrix, a few times that where nested groups squash one axis against the other,
        // and of any offset an inner group's translation cancels.
        let outer: Affine = [1, 0, 0, 1, 0, 0];
        let reach = 100;
        for (const m of chain) {
          const [ox, oy] = apply([...outer.slice(0, 4), 0, 0] as Affine, m[4], m[5]);
          reach += Math.hypot(ox, oy);
          outer = mul(outer, m);
        }
        const tol = 3e-4 * reach * chain.length + 1e-3;
        if (shaded) {
          expect(axis).toHaveLength(2);
          seen.count('shaded');
        }
        [...corners, ...axis].forEach(([cx, cy], j) => {
          const i = j % 2;
          expect(Math.abs(cx - want[i]![0]!)).toBeLessThan(tol);
          expect(Math.abs(cy - want[i]![1]!)).toBeLessThan(tol);
        });
        const extent = chain.flatMap((m) => [Math.hypot(m[0], m[1]), Math.hypot(m[2], m[3])]);
        if (extent.some((e) => e < 1e-3)) seen.count('shrunk');
        if (extent.some((e) => e > 1e3)) seen.count('grown');
      }),
      runs(RUNS),
    );
    seen.atLeast('shrunk', 20);
    seen.atLeast('grown', 20);
    seen.atLeast('shaded', 40);
  }, timeoutFor(RUNS, 20));
});
