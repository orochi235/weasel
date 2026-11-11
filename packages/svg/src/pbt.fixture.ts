/**
 * fast-check arbitraries shared by svg's property tests. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import { PATH_Z, PathBuilder, multiply, rotate, scale, translate, type Affine, type Path } from '@weasel-js/geom';
import type { Paint } from '@weasel-js/core';
import type { SvgGroupNode, SvgNode, SvgPaint, SvgPathNode, SvgStroke } from './types';

/** `{ numRuns: n }`, or the count in `WEASEL_PBT_RUNS` when set: a deep run on the fleet raises every property's at once. */
export function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}

/** A test timeout for a property costing about `msPerRun` a run, at the count {@link runs} settles on. */
export function timeoutFor(n: number, msPerRun: number): number {
  return Math.max(5_000, runs(n).numRuns * msPerRun);
}

/** A multiple of 1/8 in `±lim`: exact in float32 and in a decimal string. */
export const eighth = (lim: number): fc.Arbitrary<number> => fc.integer({ min: -lim * 8, max: lim * 8 }).map((n) => n / 8);

export const COLORS = ['#000000', '#ff0000', '#3366cc', '#ffffff', '#11aa22', '#808080'] as const;
export const color = fc.constantFrom(...COLORS);

/** An opacity a decimal string holds exactly: tenths, 1 left out as SVG's default. */
export const opacity = fc.integer({ min: 0, max: 9 }).map((n) => n / 10);

/** A star-shaped polygon: simple, so its fill is the same under either rule. */
export const polygon: fc.Arbitrary<Path> = fc.record({
  cx: eighth(60), cy: eighth(60),
  radii: fc.array(fc.integer({ min: 4, max: 50 }), { minLength: 3, maxLength: 7 }),
  turn: fc.integer({ min: 0, max: 359 }),
  closed: fc.boolean(),
}).map(({ cx, cy, radii, turn, closed }) => {
  const b = new PathBuilder();
  radii.forEach((r, i) => {
    const a = (turn + (360 * i) / radii.length) * Math.PI / 180;
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    if (i === 0) b.moveTo(x, y); else b.lineTo(x, y);
  });
  return (closed ? b.close() : b).build();
});

export const rectPath: fc.Arbitrary<Path> = fc.record({
  x: eighth(60), y: eighth(60), width: fc.integer({ min: 2, max: 80 }), height: fc.integer({ min: 2, max: 80 }),
}).map((r) => ({ kind: 'rect' as const, ...r }));

const stops = fc.array(fc.tuple(fc.integer({ min: 0, max: 10 }), color), { minLength: 2, maxLength: 4 })
  .map((xs) => xs.map(([o, c]) => ({ offset: o / 10, color: c })).sort((a, b) => a.offset - b.offset));

export const gradient: fc.Arbitrary<Paint> = fc.oneof(
  fc.record({
    from: fc.record({ x: eighth(1), y: eighth(1) }), to: fc.record({ x: eighth(1), y: eighth(1) }),
    stops, units: fc.constantFrom('bounds' as const, 'world' as const),
  }).filter((g) => g.from.x !== g.to.x || g.from.y !== g.to.y).map((g) => ({ kind: 'linear-gradient' as const, ...g })),
  fc.record({
    center: fc.record({ x: eighth(1), y: eighth(1) }), radius: fc.integer({ min: 1, max: 8 }).map((n) => n / 8),
    stops, units: fc.constantFrom('bounds' as const, 'world' as const),
  }).map((g) => ({ kind: 'radial-gradient' as const, ...g })),
);

/** A tile pattern, one of the kit's built-in kinds. */
export const tile: fc.Arbitrary<Paint> = fc.record({
  kind: fc.constantFrom('hatch' as const, 'crosshatch' as const, 'dots' as const, 'chunks' as const),
  color, size: fc.option(fc.integer({ min: 4, max: 24 }), { nil: undefined }),
}).map(({ kind, color: c, size }) => ({ kind, color: c, ...(size !== undefined ? { size } : {}) }));

export const paint: fc.Arbitrary<SvgPaint> = fc.oneof(
  fc.constant({ kind: 'none' as const }),
  fc.tuple(color, fc.option(opacity, { nil: undefined })).map(([c, o]): SvgPaint => ({
    kind: 'solid', color: c, ...(o !== undefined ? { opacity: o } : {}),
  })),
  gradient.map((p): SvgPaint => ({ kind: 'gradient', paint: p })),
  tile.map((p): SvgPaint => ({ kind: 'gradient', paint: p })),
);

export const MARKERS = ['arrow', 'arrow-open', 'diamond', 'circle', 'bar'] as const;

export const stroke: fc.Arbitrary<SvgStroke> = fc.record({
  paint: paint.filter((p) => p.kind !== 'none'),
  width: fc.integer({ min: 1, max: 40 }).map((n) => n / 4),
  cap: fc.option(fc.constantFrom('butt' as const, 'round' as const, 'square' as const), { nil: undefined }),
  join: fc.option(fc.constantFrom('miter' as const, 'round' as const, 'bevel' as const), { nil: undefined }),
  dash: fc.option(fc.array(fc.integer({ min: 1, max: 40 }).map((n) => n / 4), { minLength: 2, maxLength: 4 }), { nil: undefined, freq: 3 }),
  dashOffset: fc.option(fc.integer({ min: 1, max: 20 }).map((n) => n / 4), { nil: undefined, freq: 3 }),
  miterLimit: fc.option(fc.integer({ min: 4, max: 80 }).map((n) => n / 4), { nil: undefined, freq: 3 }),
  markerStart: fc.option(fc.constantFrom(...MARKERS), { nil: undefined, freq: 3 }),
  markerEnd: fc.option(fc.constantFrom(...MARKERS), { nil: undefined, freq: 3 }),
}).map((s) => {
  const out: SvgStroke = { paint: s.paint, width: s.width };
  for (const k of ['cap', 'join', 'dash', 'miterLimit', 'markerStart', 'markerEnd'] as const) {
    if (s[k] !== undefined) (out as unknown as Record<string, unknown>)[k] = s[k];
  }
  if (s.dash && s.dashOffset !== undefined) out.dashOffset = s.dashOffset;
  return out;
});

/** Whether `path` ends without closing: SVG fills it closed, and a writer splits its fill from its stroke. */
export const isOpen = (path: Path): boolean => path.kind === 'polygon' && path.commands[path.commands.length - 1] !== PATH_Z;

export const pathLeaf: fc.Arbitrary<SvgPathNode> = fc.record({
  path: fc.oneof(polygon, rectPath),
  fill: paint,
  stroke: fc.option(stroke, { nil: undefined }),
  opacity: fc.option(opacity, { nil: undefined, freq: 3 }),
  hidden: fc.option(fc.constant(true as const), { nil: undefined, freq: 6 }),
}).map(({ path, fill, stroke, opacity, hidden }) => ({
  kind: 'path', path, fill: isOpen(path) ? { kind: 'none' } : fill,
  ...(stroke ? { stroke } : {}), ...(opacity !== undefined ? { opacity } : {}), ...(hidden ? { hidden } : {}),
}));

/** Translate, rotate, and a uniform scale: what a stroke width goes through as one number. */
export const similarity: fc.Arbitrary<Affine> = fc.tuple(
  eighth(100), eighth(100), fc.integer({ min: -180, max: 180 }), fc.constantFrom(0.5, 1, 2, 4),
).map(([tx, ty, deg, s]) => multiply(translate(tx, ty), multiply(rotate(deg * Math.PI / 180), scale(s, s))));

/** Trees of path leaves under groups that move, fade, clip, and hide what they hold. */
export function tree(leaf: fc.Arbitrary<SvgNode> = pathLeaf): fc.Arbitrary<SvgNode[]> {
  const { node } = fc.letrec((tie) => ({
    node: fc.oneof(
      { depthSize: 'small', withCrossShrink: true },
      leaf,
      fc.record({
        children: fc.array(tie('node') as fc.Arbitrary<SvgNode>, { minLength: 1, maxLength: 3 }),
        transform: fc.option(similarity, { nil: undefined }),
        opacity: fc.option(opacity, { nil: undefined, freq: 3 }),
        clip: fc.option(fc.oneof(rectPath, polygon), { nil: undefined, freq: 3 }),
        hidden: fc.option(fc.constant(true as const), { nil: undefined, freq: 6 }),
      }).map(({ children, transform, opacity, clip, hidden }): SvgGroupNode => ({
        kind: 'group', children,
        ...(transform ? { transform } : {}), ...(opacity !== undefined ? { opacity } : {}),
        ...(clip ? { clip } : {}), ...(hidden ? { hidden } : {}),
      })),
    ),
  }));
  return fc.array(node, { minLength: 1, maxLength: 3 });
}
