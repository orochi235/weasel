/**
 * fast-check arbitraries shared by p-touch's property tests: labels of commands the `.lbx` writer states as
 * objects. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import { mat3, PathBuilder } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import type { ResolvedRun } from '@weasel-js/text';
import { TAPES } from './tape';

/** `{ numRuns: n }`, or the count in `WEASEL_PBT_RUNS` when set: a deep run on the fleet raises every property's at once. */
export function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}

/** A test timeout for a property costing about `msPerRun` a run, at the count {@link runs} settles on. */
export function timeoutFor(n: number, msPerRun: number): number {
  return Math.max(5_000, runs(n).numRuns * msPerRun);
}

export const tape = fc.constantFrom(...TAPES);

/** A finite coordinate, small, huge, or fractional. */
export const coord = fc.oneof(
  fc.double({ min: -500, max: 500, noNaN: true, noDefaultInfinity: true }),
  fc.integer({ min: -200, max: 200 }),
  fc.double({ min: -1e9, max: 1e9, noNaN: true, noDefaultInfinity: true }),
);
const extent = fc.oneof(fc.double({ min: 0.01, max: 300, noNaN: true }), fc.integer({ min: 1, max: 100 }));

/** Text as a label holds it: XML's specials, line breaks of every kind, controls, astral and lone surrogates. */
export const labelText = fc.oneof(
  { weight: 3, arbitrary: fc.string({ unit: 'grapheme', maxLength: 10 }) },
  { weight: 2, arbitrary: fc.string({ unit: 'binary', maxLength: 10 }) },
  {
    weight: 3,
    arbitrary: fc.array(fc.constantFrom('a', '<', '>', '&', '"', "'", '&amp;', ']]>', '\n', '\r', '\r\n', '\t', '\u0001', '\u2028', '😀', '\ud800', ' ', '  '), { maxLength: 8 })
      .map((a) => a.join('')),
  },
);

const color = fc.constantFrom('#000000', '#ffffff', 'red', '#123456', 'rgb(10, 200, 30)');

export const solidRect: fc.Arbitrary<DrawCommand> = fc.record({
  x: coord, y: coord, w: fc.oneof(extent, extent.map((e) => -e)), h: fc.oneof(extent, extent.map((e) => -e)),
  fill: fc.option(color, { nil: undefined }), stroke: fc.option(fc.tuple(color, extent), { nil: undefined }),
}).filter((r) => r.fill !== undefined || r.stroke !== undefined).map((r) => ({
  kind: 'path',
  path: { kind: 'rect', x: r.x, y: r.y, width: r.w, height: r.h },
  ...(r.fill ? { fill: { paint: { color: r.fill } } } : {}),
  ...(r.stroke ? { stroke: { paint: { color: r.stroke[0] }, width: r.stroke[1] } } : {}),
}));

export const polyline: fc.Arbitrary<DrawCommand> = fc.record({
  points: fc.array(fc.tuple(coord, coord), { minLength: 2, maxLength: 5 }),
  color, width: extent, cap: fc.constantFrom('butt' as const, 'round' as const, 'square' as const),
}).map(({ points, color, width, cap }) => {
  const b = new PathBuilder().moveTo(points[0]![0], points[0]![1]);
  for (const [x, y] of points.slice(1)) b.lineTo(x, y);
  return { kind: 'path', path: b.build(), stroke: { paint: { color }, width, cap } };
});

const run = (text: string, over: Partial<ResolvedRun>): ResolvedRun => ({
  text, fontFamily: 'Helvetica', fontSize: 12, fontWeight: 400, fontStyle: 'normal',
  fill: { paint: { color: '#000000' } }, letterSpacing: 0, underline: false, strikethrough: false,
  overline: false, baselineShift: 0, ...over,
} as ResolvedRun);

export const textBox: fc.Arbitrary<DrawCommand> = fc.record({
  texts: fc.array(labelText, { minLength: 1, maxLength: 3 }),
  family: fc.oneof(fc.constantFrom('Helvetica', 'Noto Sans "CJK"', 'A&B <Mono>', ''), labelText),
  size: extent, weight: fc.constantFrom(400, 700, 300), italic: fc.boolean(), underline: fc.boolean(),
  x: coord, y: coord, width: extent, height: extent, wrap: fc.boolean(), color,
  align: fc.constantFrom('left', 'center', 'right', 'justify', 'start', 'end'),
}).map((t) => ({
  kind: 'text',
  x: t.x, y: t.y, width: t.width, height: t.height, ...(t.wrap ? { maxWidth: t.width } : {}),
  style: {}, align: t.align as never, verticalAlign: 'top',
  runs: t.texts.map((text) => run(text, {
    fontFamily: t.family, fontSize: t.size, fontWeight: t.weight, fontStyle: t.italic ? 'italic' : 'normal', underline: t.underline,
    fill: { paint: { color: t.color } },
  })),
} as DrawCommand));

/** An axis-aligned map with no flip: what the writer places objects through. */
export const axisGroup = (children: fc.Arbitrary<DrawCommand[]>): fc.Arbitrary<DrawCommand> =>
  fc.record({ sx: fc.double({ min: 0.1, max: 10, noNaN: true }), tx: coord, ty: coord, children })
    .map(({ sx, tx, ty, children }) => ({ kind: 'group', transform: mat3.scaled(mat3.translated(mat3.identity(), tx, ty), sx, sx), children }));

export const objectCommand: fc.Arbitrary<DrawCommand> = fc.oneof(
  solidRect, polyline, textBox, axisGroup(fc.array(fc.oneof(solidRect, polyline, textBox), { maxLength: 3 })),
);
