/**
 * Property tests of the document around the drawing: any list of pages, empty ones and ones of any size
 * included, is a page tree holding each page in order with its own media box and content, or a refusal
 * naming the page that has no area; and groups nested to any depth write a file, drawing what lies
 * within `NESTING_LIMIT` groups and reporting what lies deeper.
 */
import { deflateSync } from 'node:zlib';
import { mat3 } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { NESTING_LIMIT } from './drawCommands';
import { num } from './num';
import { checkPdf } from './pdfCheck.fixture';
import { commands, coord, readFakePixels, runs, tally, timeoutFor } from './pbt.fixture';
import { type Dict, Name, readContent, Ref, type Value } from './pdfReader.fixture';
import { NO_FONTS } from './testing/noFonts';
import { type PdfPage, writePdfWith } from './writePdf';

const RUNS = 150;
const zlib = async (d: Uint8Array) => new Uint8Array(deflateSync(d));
const write = (pages: PdfPage[], compress = false) => writePdfWith(pages, { fonts: NO_FONTS, readPixels: readFakePixels, compress }, zlib);

const side = fc.oneof(
  { weight: 6, arbitrary: fc.integer({ min: 1, max: 2000 }) },
  { weight: 3, arbitrary: fc.double({ min: 1e-3, max: 1e4, noNaN: true }) },
  { weight: 1, arbitrary: fc.constantFrom(0, -0, -1, -612, 1e-5, 4e-5, 6e-5, 1e-4, 1e9, 1e30, NaN, Infinity, -Infinity) },
);

/** Whether a page this size has an area its media box can write. */
const writable = (n: number) => Number.isFinite(n) && n > 0 && num(n) !== '0';

const view = fc.option(
  fc.oneof(
    fc.constant(mat3.identity()),
    fc.tuple(fc.double({ min: 1e-3, max: 1e3, noNaN: true }), coord, coord).map(([s, e, f]) => mat3.fromAffine([s, 0, 0, s, e, f])),
  ),
  { nil: undefined },
);

const pages = fc.array(
  fc.record({ width: side, height: side, view, commands: fc.oneof(fc.constant([] as DrawCommand[]), commands(coord, 1)) }),
  { minLength: 1, maxLength: 4 },
);

const asDict = (v: Value) => v as Dict;

describe('the page tree', () => {
  it('holds every page in order with its own box and content, or refuses the first page with no area', async () => {
    const seen = tally();
    await fc.assert(
      fc.asyncProperty(pages, fc.boolean(), async (list, compress) => {
        const bad = list.findIndex((p) => !writable(p.width) || !writable(p.height));
        if (bad >= 0) {
          await expect(write(list, compress)).rejects.toThrow(new RegExp(`^pdf: page ${bad + 1} `));
          seen.count('refused');
          return;
        }
        const { bytes } = await write(list, compress);
        const { pdf } = checkPdf(bytes);
        const get = (r: Value | undefined) => (r instanceof Ref ? pdf.objects.get(r.id)! : undefined);
        const catalog = asDict(get(pdf.trailer.Root)!.value);
        expect((catalog.Type as Name).value).toBe('Catalog');
        const tree = asDict(get(catalog.Pages)!.value);
        expect(tree.Count).toBe(list.length);
        const kids = tree.Kids as Ref[];
        expect(kids.length).toBe(list.length);
        kids.forEach((kid, i) => {
          const page = asDict(get(kid)!.value);
          expect((page.Type as Name).value).toBe('Page');
          expect((page.Parent as Ref).id).toBe((catalog.Pages as Ref).id);
          expect(page.MediaBox).toEqual([0, 0, Number(num(list[i]!.width)), Number(num(list[i]!.height))]);
          const ops = readContent(get(page.Contents)!.stream!.data);
          expect(ops[0]).toEqual({ op: 'cm', args: [1, 0, 0, -1, 0, Number(num(list[i]!.height))] });
          if (list[i]!.commands.length === 0) {
            expect(ops.length).toBe(1);
            expect(page.Resources).toEqual({});
            seen.count('empty page');
          }
        });
        expect(new Set(kids.map((k) => k.id)).size).toBe(kids.length);
        seen.count(list.length > 1 ? 'pages' : 'page');
      }),
      runs(RUNS),
    );
    for (const what of ['refused', 'empty page', 'pages', 'page']) seen.atLeast(what, 5);
  }, timeoutFor(RUNS, 200));
});

const leaf: DrawCommand = { kind: 'path', path: { kind: 'rect', x: 1, y: 1, width: 5, height: 5 }, fill: { paint: { color: '#f00' } } };

/** `leaf` inside `depth` groups, each picked from a plain, a moved, a faded, or an isolated one. */
function nest(depth: number, kinds: readonly number[]): DrawCommand {
  let cmd = leaf;
  for (let i = 0; i < depth; i++) {
    const k = kinds[i % kinds.length]!;
    cmd = k === 0 ? { kind: 'group', children: [cmd] }
      : k === 1 ? { kind: 'group', transform: mat3.fromAffine([1, 0, 0, 1, 0.5, 0]), children: [cmd] }
        : k === 2 ? { kind: 'group', alpha: 0.999, children: [cmd] }
          : { kind: 'group', isolate: true, children: [cmd] };
  }
  return cmd;
}

describe('nesting', () => {
  it('draws what lies within the limit and reports what lies deeper, at any depth', async () => {
    const seen = tally();
    const depth = fc.oneof(
      fc.integer({ min: 0, max: 40 }),
      fc.constantFrom(NESTING_LIMIT - 1, NESTING_LIMIT, NESTING_LIMIT + 1, 3 * NESTING_LIMIT, 50_000),
    );
    // An isolated group is a form of its own: a deep chain of them is slow to write, so they stay rare.
    const kinds = fc.array(fc.oneof({ weight: 8, arbitrary: fc.constantFrom(0, 1, 2) }, { weight: 1, arbitrary: fc.constant(3) }), { minLength: 1, maxLength: 4 });
    await fc.assert(
      fc.asyncProperty(depth, kinds, async (d, k) => {
        const { bytes, skipped } = await write([{ width: 50, height: 50, commands: [nest(d, k)] }]);
        const { seen: s } = checkPdf(bytes);
        const drawn = (s.ops.get('re') ?? 0) > 0;
        if (d <= NESTING_LIMIT) {
          expect(drawn).toBe(true);
          expect(skipped).toEqual([]);
          seen.count(d === NESTING_LIMIT ? 'at the limit' : 'within');
        } else {
          expect(drawn).toBe(false);
          expect(skipped).toEqual([{ kind: 'command', detail: `groups nest more than ${NESTING_LIMIT} deep; what is deeper is not drawn` }]);
          seen.count('deeper');
        }
      }),
      runs(RUNS / 3),
    );
    for (const what of ['within', 'at the limit', 'deeper']) seen.atLeast(what, 2);
  }, timeoutFor(RUNS / 3, 600));
});
