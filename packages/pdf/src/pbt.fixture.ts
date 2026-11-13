/**
 * fast-check arbitraries shared by pdf's property tests. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import { mat3, PATH_C, PATH_L, PATH_M, PATH_Q, PATH_Z, type Path } from '@weasel-js/geom';
import type { CommandPaint, CommandStroke, GradStop } from '@weasel-js/paint';
import type { DrawCommand, GroupDrawCommand, ImageDrawCommand } from '@weasel-js/renderer';

/** `{ numRuns: n }`, or the count in `WEASEL_PBT_RUNS` when set: a deep run on the fleet raises every property's at once. */
export function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}

/** A test timeout for a property costing about `msPerRun` a run, at the count {@link runs} settles on. */
export function timeoutFor(n: number, msPerRun: number): number {
  return Math.max(5_000, runs(n).numRuns * msPerRun);
}

/** How often each path ran, so a property that exercised nothing fails rather than passes. */
export function tally(): { count(what: string): void; atLeast(what: string, n: number): void } {
  const seen = new Map<string, number>();
  return {
    count(what) { seen.set(what, (seen.get(what) ?? 0) + 1); },
    atLeast(what, n) {
      if ((seen.get(what) ?? 0) < n) throw new Error(`${what} ran ${seen.get(what) ?? 0} times, wanted ${n}: ${JSON.stringify([...seen])}`);
    },
  };
}

/** Any finite double, weighted toward the ones a writer gets wrong: tiny, huge, whole, and near a rounding edge. */
export const anyFinite: fc.Arbitrary<number> = fc.oneof(
  { weight: 3, arbitrary: fc.double({ min: -1000, max: 1000, noNaN: true }) },
  { weight: 1, arbitrary: fc.integer({ min: -1e6, max: 1e6 }) },
  { weight: 1, arbitrary: fc.double({ noNaN: true, noDefaultInfinity: true }) },
  { weight: 1, arbitrary: fc.double({ min: -1e-3, max: 1e-3, noNaN: true }) },
  { weight: 1, arbitrary: fc.integer({ min: -1e6, max: 1e6 }).map((n) => n / 1e4 + 5e-5) },
  { weight: 1, arbitrary: fc.constantFrom(0, -0, 1e21, -1e21, 1e-7, Number.MAX_VALUE, Number.MIN_VALUE, 2 ** 53, 0.1 + 0.2) },
);

/** A coordinate a drawing plausibly holds: mostly on the page, sometimes far off it or very fine. */
export const coord: fc.Arbitrary<number> = fc.oneof(
  { weight: 6, arbitrary: fc.double({ min: -50, max: 250, noNaN: true }) },
  { weight: 2, arbitrary: fc.integer({ min: -20, max: 220 }) },
  { weight: 1, arbitrary: fc.double({ min: -1e-3, max: 1e-3, noNaN: true }) },
  { weight: 1, arbitrary: fc.double({ min: -1e9, max: 1e9, noNaN: true }) },
);

/** A coordinate, now and then not finite. */
export const wildCoord: fc.Arbitrary<number> = fc.oneof(
  { weight: 30, arbitrary: coord },
  { weight: 1, arbitrary: fc.constantFrom(NaN, Infinity, -Infinity, 3e38, -3e38) },
);

const pt = (c: fc.Arbitrary<number>) => fc.record({ x: c, y: c });

/** A polygon path from a random command list, M first, or a rect. */
export function path(c: fc.Arbitrary<number> = coord): fc.Arbitrary<Path> {
  const seg = fc.oneof(
    fc.tuple(fc.constant(PATH_L), fc.array(c, { minLength: 2, maxLength: 2 })),
    fc.tuple(fc.constant(PATH_C), fc.array(c, { minLength: 6, maxLength: 6 })),
    fc.tuple(fc.constant(PATH_Q), fc.array(c, { minLength: 4, maxLength: 4 })),
    fc.tuple(fc.constant(PATH_M), fc.array(c, { minLength: 2, maxLength: 2 })),
    fc.tuple(fc.constant(PATH_Z), fc.constant([] as number[])),
  );
  const polygon = fc
    .record({
      start: fc.array(c, { minLength: 2, maxLength: 2 }),
      segs: fc.array(seg, { minLength: 1, maxLength: 8 }),
      fillRule: fc.constantFrom('nonzero' as const, 'evenodd' as const),
      openFill: fc.constantFrom('none' as const, 'close' as const, undefined),
    })
    .map(({ start, segs, fillRule, openFill }): Path => ({
      kind: 'polygon',
      commands: Uint8Array.from([PATH_M, ...segs.map(([k]) => k)]),
      coords: Float32Array.from([...start, ...segs.flatMap(([, v]) => v)]),
      fillRule,
      ...(openFill && { openFill }),
    }));
  const rect = fc.record({ x: c, y: c, width: c, height: c }).map((r): Path => ({ kind: 'rect', ...r }));
  return fc.oneof({ weight: 3, arbitrary: polygon }, { weight: 1, arbitrary: rect });
}

const byte = fc.integer({ min: 0, max: 255 });
const hex = (v: number) => v.toString(16).padStart(2, '0');

/** A CSS color a command may carry: hex, `rgb()`, a name, or a transparent one. */
export const cssColor: fc.Arbitrary<string> = fc.oneof(
  fc.tuple(byte, byte, byte).map(([r, g, b]) => `#${hex(r)}${hex(g)}${hex(b)}`),
  fc.tuple(byte, byte, byte, byte).map(([r, g, b, a]) => `#${hex(r)}${hex(g)}${hex(b)}${hex(a)}`),
  fc.tuple(byte, byte, byte, fc.double({ min: 0, max: 1, noNaN: true })).map(([r, g, b, a]) => `rgba(${r}, ${g}, ${b}, ${a})`),
  fc.constantFrom('red', 'transparent', 'black', 'white', 'rebeccapurple'),
);

const unit = fc.oneof(fc.double({ min: 0, max: 1, noNaN: true }), fc.constantFrom(0, 1));

const stops: fc.Arbitrary<GradStop[]> = fc.array(
  fc.record({ offset: fc.oneof(unit, fc.double({ min: -0.5, max: 1.5, noNaN: true })), color: cssColor }),
  { minLength: 0, maxLength: 5 },
);

/** A solid paint or a gradient of any kind, in any command unit. */
export function paint(c: fc.Arbitrary<number> = coord): fc.Arbitrary<CommandPaint> {
  const units = fc.constantFrom('local' as const, 'world' as const, 'screen' as const, undefined);
  const opacity = fc.option(unit, { nil: undefined });
  const interpolate = fc.constantFrom('rgb' as const, 'oklab' as const, undefined);
  return fc.oneof(
    { weight: 4, arbitrary: fc.record({ color: cssColor, opacity }) },
    { weight: 1, arbitrary: fc.record({ kind: fc.constant('linear-gradient' as const), from: pt(c), to: pt(c), stops, units, interpolate, opacity }) },
    { weight: 1, arbitrary: fc.record({ kind: fc.constant('radial-gradient' as const), center: pt(c), radius: c, stops, units, interpolate, opacity }) },
    { weight: 1, arbitrary: fc.record({ kind: fc.constant('conic-gradient' as const), center: pt(c), angle: fc.double({ min: -7, max: 7, noNaN: true }), stops, units, opacity }) },
  ).map((p) => JSON.parse(JSON.stringify(p)) as CommandPaint);
}

/**
 * A stroke with any cap, join, miter limit, dash, and width. One PDF draws natively (solid, centered)
 * may be very wide or sized in pixels; any other is outlined through `strokeToPath`, whose union of a
 * ribbon a million wide takes most of a second (`wideStrokeUnion.bench.ts` in stroke), so its width stays
 * in plain units under 50.
 */
export function stroke(c: fc.Arbitrary<number> = coord): fc.Arbitrary<CommandStroke> {
  const len = fc.oneof(fc.double({ min: 0, max: 20, noNaN: true }), fc.constantFrom(0, 1e-6, 1e6, -1));
  const style = {
    cap: fc.constantFrom('butt' as const, 'round' as const, 'square' as const),
    join: fc.constantFrom('miter' as const, 'round' as const, 'bevel' as const),
    miterLimit: fc.oneof(fc.double({ min: 0, max: 20, noNaN: true }), fc.constantFrom(0, 0.5, 1, -1)),
    dash: fc.array(len, { maxLength: 4 }),
    dashOffset: fc.double({ min: -50, max: 50, noNaN: true }),
    trim: fc.record({ start: unit, end: unit }),
  };
  const native = fc.record(
    {
      paint: fc.record({ color: cssColor, opacity: fc.option(unit, { nil: undefined }) }),
      width: fc.oneof(len, fc.record({ px: fc.double({ min: 0, max: 10, noNaN: true }) })),
      ...style,
    },
    { requiredKeys: ['paint', 'width'] },
  );
  const outlined = fc.record(
    {
      paint: paint(c),
      width: fc.double({ min: 0, max: 50, noNaN: true }),
      ...style,
      align: fc.constantFrom('center' as const, 'inner' as const, 'outer' as const),
    },
    { requiredKeys: ['paint', 'width'] },
  );
  return fc.oneof(native, outlined);
}

/** A non-singular affine as a GlMat3, scaled anywhere from very small to very large. */
export const transform = fc
  .tuple(
    fc.double({ min: -Math.PI, max: Math.PI, noNaN: true }),
    fc.oneof(fc.double({ min: 0.1, max: 10, noNaN: true }), fc.constantFrom(1e-5, 1e-3, 1e3, 1e5)),
    fc.double({ min: 0.2, max: 5, noNaN: true }),
    coord,
    coord,
  )
  .map(([a, s, k, e, f]) => mat3.fromAffine([Math.cos(a) * s, Math.sin(a) * s, -Math.sin(a) * s * k, Math.cos(a) * s * k, e, f]));

const colorMatrix = fc.array(fc.double({ min: -2, max: 2, noNaN: true }), { minLength: 20, maxLength: 20 });

/** A fake bitmap, with the pixels `readPixels` hands back for it. */
export interface FakeImage { width: number; height: number; pixels: Uint8ClampedArray }

export const fakeImage: fc.Arbitrary<FakeImage> = fc
  .record({ width: fc.integer({ min: 1, max: 4 }), height: fc.integer({ min: 1, max: 4 }), seed: fc.integer() })
  .map(({ width, height, seed }) => ({
    width,
    height,
    pixels: Uint8ClampedArray.from({ length: width * height * 4 }, (_, i) => ((seed + i * 97) >>> 0) % 256),
  }));

/** A texture paint over registered texture `id`, its tile any size, fine or coarse. */
export function texturePaint(id: string, c: fc.Arbitrary<number> = coord): fc.Arbitrary<CommandPaint> {
  const size = fc.oneof(fc.double({ min: 0.5, max: 40, noNaN: true }), fc.constantFrom(1e-7, 1e-3, 1e5, 0, -1));
  return fc
    .record(
      {
        units: fc.constantFrom('local' as const, 'world' as const, 'screen' as const),
        origin: pt(c),
        transform: fc.tuple(fc.double({ min: -3, max: 3, noNaN: true }), fc.constant(0), fc.constant(0), fc.double({ min: -3, max: 3, noNaN: true })),
        width: size,
        height: size,
        opacity: fc.option(unit, { nil: undefined }),
      },
      { requiredKeys: ['units'] },
    )
    .map((t) => ({ kind: 'texture', texture: { id }, ...t }) as unknown as CommandPaint);
}

/** Draw commands nested up to `depth` groups deep: paths, images, and groups with every option. `fills` adds paints to the fills drawn. */
export function commands(c: fc.Arbitrary<number> = coord, depth = 2, fills?: fc.Arbitrary<CommandPaint>): fc.Arbitrary<DrawCommand[]> {
  const fill = fills ? fc.oneof({ weight: 3, arbitrary: paint(c) }, { weight: 1, arbitrary: fills }) : paint(c);
  const pathCmd: fc.Arbitrary<DrawCommand> = fc
    .record({ path: path(c), fill: fc.option(fc.record({ paint: fill }), { nil: undefined }), stroke: fc.option(stroke(c), { nil: undefined }) })
    .map(({ path: p, fill, stroke: s }) => ({ kind: 'path', path: p, ...(fill && { fill }), ...(s && { stroke: s }) }));
  const imageCmd: fc.Arbitrary<DrawCommand> = fc
    .record({ img: fakeImage, x: c, y: c, w: c, h: c, opacity: fc.option(unit, { nil: undefined }), sampling: fc.constantFrom('linear' as const, 'nearest' as const) })
    .map(({ img, ...rest }): ImageDrawCommand => ({ kind: 'image', image: img as unknown as ImageBitmap, ...rest }));
  const leaf = fc.oneof({ weight: 5, arbitrary: pathCmd }, { weight: 1, arbitrary: imageCmd });
  if (depth === 0) return fc.array(leaf, { maxLength: 4 });
  const group: fc.Arbitrary<DrawCommand> = fc
    .record(
      {
        transform,
        alpha: unit,
        colorMatrix,
        clip: path(c),
        isolate: fc.boolean(),
        children: fc.constant(null),
      },
      { requiredKeys: ['children'] },
    )
    .chain((g) => commands(c, depth - 1, fills).map((children): GroupDrawCommand => ({ ...g, kind: 'group', children })));
  return fc.array(fc.oneof({ weight: 3, arbitrary: leaf }, { weight: 1, arbitrary: group }), { maxLength: 5 });
}

/** `readPixels` for {@link fakeImage}s. */
export function readFakePixels(image: unknown): { width: number; height: number; data: Uint8ClampedArray } {
  const img = image as FakeImage;
  return { width: img.width, height: img.height, data: img.pixels };
}
