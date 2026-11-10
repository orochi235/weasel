/**
 * What `roundtrip-property.test.ts` leaves out: the first pass. Parsing is lossy by design (a group's transform
 * collapses onto what it holds), so this compares what each leaf draws, not its text: through serialize and
 * parse, and then through the kit's drafts and back, every leaf keeps its fill and covers the same points of the
 * world. Points near an outline are skipped, where flattening and float32 coordinates can move it.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  PathBuilder, boundsOfPath, multiply, pointInPath, rotate, rotateAboutPoint, scale, strokeHitTest, transformPath,
  translate, type Affine, type Path,
} from '@weasel-js/geom';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import { svgNodesToKitDrafts } from './unpack';
import { svgNodesFromKit, type SvgKitTree, type SvgKitTreeNode } from './fromKit';
import { IDENTITY_MATRIX, type SvgNode, type SvgPathNode } from './types';

const RUNS = { numRuns: Number(globalThis.process?.env?.WEASEL_PBT_RUNS) || 80 };
const TIMEOUT = Math.max(5_000, RUNS.numRuns * 40);
const COLORS = ['#000000', '#ff0000', '#3366cc', '#ffffff', '#11aa22'];

const coord = (lim: number) => fc.integer({ min: -lim * 8, max: lim * 8 }).map((n) => n / 8);

/** A star-shaped polygon: simple, so its fill is the same under either rule. */
const polygon: fc.Arbitrary<Path> = fc.record({
  cx: coord(60), cy: coord(60),
  radii: fc.array(fc.integer({ min: 4, max: 50 }), { minLength: 3, maxLength: 7 }),
  turn: fc.integer({ min: 0, max: 359 }),
}).map(({ cx, cy, radii, turn }) => {
  const b = new PathBuilder();
  radii.forEach((r, i) => {
    const a = (turn + (360 * i) / radii.length) * Math.PI / 180;
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    if (i === 0) b.moveTo(x, y); else b.lineTo(x, y);
  });
  return b.close().build();
});
const rectPath: fc.Arbitrary<Path> = fc.record({ x: coord(60), y: coord(60), width: fc.integer({ min: 2, max: 80 }), height: fc.integer({ min: 2, max: 80 }) })
  .map((r) => ({ kind: 'rect' as const, ...r }));

const leaf: fc.Arbitrary<SvgPathNode> = fc.record({
  path: fc.oneof(polygon, rectPath),
  color: fc.constantFrom(...COLORS),
  rotation: fc.option(fc.integer({ min: -180, max: 180 }).map((d) => d * Math.PI / 180), { nil: undefined, freq: 2 }),
}).map(({ path, color, rotation }) => ({
  kind: 'path', path, fill: { kind: 'solid', color }, ...(rotation ? { rotation } : {}),
}));

/** A group transform, well conditioned: translate, rotate, uniform scale, and some non-uniform scale. */
const transform: fc.Arbitrary<Affine> = fc.tuple(
  coord(100), coord(100), fc.integer({ min: -180, max: 180 }), fc.double({ min: 0.5, max: 2, noNaN: true }),
  fc.double({ min: 0.5, max: 2, noNaN: true }),
).map(([tx, ty, deg, sx, sy]) => multiply(translate(tx, ty), multiply(rotate(deg * Math.PI / 180), scale(sx, sy))));

const { node } = fc.letrec((tie) => ({
  node: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    leaf,
    fc.tuple(fc.array(tie('node') as fc.Arbitrary<SvgNode>, { minLength: 1, maxLength: 3 }), fc.option(transform, { nil: undefined }))
      .map(([children, t]): SvgNode => ({ kind: 'group', children, ...(t ? { transform: t } : {}) })),
  ),
}));

/** Each leaf as what it draws in the world: its fill and its path through every transform above it. */
function drawn(nodes: readonly SvgNode[], m: Affine = IDENTITY_MATRIX): { color: string; path: Path }[] {
  return nodes.flatMap((n) => {
    if (n.kind === 'group') return drawn(n.children, n.transform ? multiply(m, n.transform) : m);
    if (n.kind !== 'path' || n.fill.kind !== 'solid') return [];
    const b = boundsOfPath(n.path);
    const own = n.rotation ? rotateAboutPoint(b.x + b.width / 2, b.y + b.height / 2, n.rotation) : IDENTITY_MATRIX;
    return [{ color: n.fill.color, path: transformPath(n.path, multiply(m, own)) }];
  });
}

const probes = fc.array(fc.tuple(coord(250), coord(250)), { minLength: 25, maxLength: 25 });

function sameDrawing(want: readonly SvgNode[], got: readonly SvgNode[], pts: readonly (readonly [number, number])[]): number {
  const a = drawn(want), b = drawn(got);
  expect(b.map((l) => l.color)).toEqual(a.map((l) => l.color));
  let checked = 0;
  a.forEach((l, i) => {
    const r = b[i]!;
    for (const [x, y] of pts) {
      if (strokeHitTest(l.path, x, y, 0.05) || strokeHitTest(r.path, x, y, 0.05)) continue;
      expect(pointInPath(r.path, x, y), `leaf ${i} at (${x}, ${y})`).toBe(pointInPath(l.path, x, y));
      checked++;
    }
  });
  return checked;
}

/** The drafts as a tree `svgNodesFromKit` walks: they carry world poses, so no composition. */
function treeOf(drafts: ReturnType<typeof svgNodesToKitDrafts>): SvgKitTree {
  const byId = new Map(drafts.map((d) => [d.id, d]));
  const kids = (parent: string | null) => drafts.filter((d) => d.parentId === parent).map((d) => d.id);
  return {
    roots: kids(null),
    childrenOf: (id) => kids(id),
    get: (id) => byId.get(id) as unknown as SvgKitTreeNode | undefined,
  };
}

describe('SVG round trips keep what each leaf draws, property', () => {
  it('through serialize and parse, the first pass included', () => {
    let checked = 0;
    fc.assert(fc.property(fc.array(node, { minLength: 1, maxLength: 3 }), probes, (nodes, pts) => {
      checked += sameDrawing(nodes, parseSvg(serializeSvg(nodes)).nodes, pts);
    }), RUNS);
    expect(checked).toBeGreaterThan(RUNS.numRuns * 10);
  }, TIMEOUT);

  it('through the kit: parsed, drafted as scene nodes, and walked back out', () => {
    fc.assert(fc.property(fc.array(node, { minLength: 1, maxLength: 3 }), probes, (nodes, pts) => {
      const parsed = parseSvg(serializeSvg(nodes));
      let n = 0;
      const back = svgNodesFromKit(treeOf(svgNodesToKitDrafts(parsed, () => `n${n++}`)));
      sameDrawing(parsed.nodes, back, pts);
    }), RUNS);
  }, TIMEOUT);
});
