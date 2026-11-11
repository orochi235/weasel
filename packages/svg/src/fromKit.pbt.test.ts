/**
 * The kit-to-SVG walk: a scene of groups and marks whose fills and strokes are set, cleared, or `'inherit'`
 * from the nearest container, through `svgNodesFromKit`, `serializeSvg`, and `parseSvg`. Each leaf reads back
 * painted as the kit resolves it: whatever the walk leaves to SVG's own cascade has to arrive there intact.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { INHERIT, type Fill, type Inherit, type Paint, type Stroke } from '@weasel-js/core';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import { svgNodesFromKit, type SvgKitTree, type SvgKitTreeNode } from './fromKit';
import type { SvgNode, SvgPaint } from './types';
import { color, eighth, gradient, opacity, runs, tile, timeoutFor } from './pbt.fixture';

const N = 150;

const kitPaint: fc.Arbitrary<Paint> = fc.oneof(
  { weight: 3, arbitrary: fc.tuple(color, fc.option(opacity, { nil: undefined })).map(([c, o]): Paint => ({ kind: 'solid', color: c, ...(o !== undefined ? { opacity: o } : {}) })) },
  { weight: 1, arbitrary: gradient },
  { weight: 1, arbitrary: tile },
);
const fill: fc.Arbitrary<Fill | Inherit | null | undefined> = fc.oneof(
  { weight: 3, arbitrary: kitPaint.map((paint) => ({ paint })) },
  { weight: 2, arbitrary: fc.constant(INHERIT) },
  { weight: 1, arbitrary: fc.constantFrom(null, undefined) },
);
const stroke: fc.Arbitrary<Stroke | Inherit | null | undefined> = fc.oneof(
  {
    weight: 2,
    arbitrary: fc.tuple(
      kitPaint, fc.integer({ min: 1, max: 12 }), fc.option(fc.constantFrom('round' as const, 'square' as const), { nil: undefined }),
      fc.option(fc.tuple(fc.integer({ min: 1, max: 9 }), fc.integer({ min: 1, max: 9 })), { nil: undefined }),
    ).map(([paint, w, cap, dash]): Stroke => ({ paint, width: w / 2, ...(cap ? { cap } : {}), ...(dash ? { dash } : {}) })),
  },
  { weight: 2, arbitrary: fc.constant(INHERIT) },
  { weight: 2, arbitrary: fc.constantFrom(null, undefined) },
);

interface Spec {
  group: boolean;
  fill: Fill | Inherit | null | undefined;
  stroke: Stroke | Inherit | null | undefined;
  box: { x: number; y: number; width: number; height: number };
  rotation: number;
  children: Spec[];
}

const box = fc.record({ x: eighth(50), y: eighth(50), width: fc.integer({ min: 1, max: 40 }), height: fc.integer({ min: 1, max: 40 }) });
const { spec } = fc.letrec((tie) => ({
  spec: fc.record({
    group: fc.boolean(),
    fill, stroke, box,
    rotation: fc.option(fc.integer({ min: -180, max: 180 }).map((d) => d * Math.PI / 180), { nil: 0, freq: 3 }),
    children: fc.oneof({ depthSize: 'small' }, fc.constant([]), fc.array(tie('spec') as fc.Arbitrary<Spec>, { minLength: 1, maxLength: 3 })),
  }),
}));

function treeOf(roots: readonly Spec[]): SvgKitTree {
  const nodes = new Map<string, SvgKitTreeNode>();
  const kids = new Map<string, string[]>();
  let n = 0;
  const add = (s: Spec): string => {
    const id = `n${n++}`;
    nodes.set(id, {
      kind: s.group ? 'group' : 'path',
      data: { ...(s.group ? {} : { path: { kind: 'rect', ...s.box } }), fill: s.fill, stroke: s.stroke },
      pose: { ...s.box, ...(s.rotation ? { rotation: s.rotation } : {}) },
    });
    kids.set(id, s.children.map(add));
    return id;
  };
  const top = roots.map(add);
  return { roots: top, childrenOf: (id) => kids.get(id) ?? [], get: (id) => nodes.get(id) };
}

const paintKey = (p: Paint | null | undefined): unknown => {
  if (!p) return 'none';
  if (p.kind === undefined || p.kind === 'solid') return { color: p.color, opacity: p.opacity ?? 1 };
  return {
    kind: p.kind, stops: 'stops' in p ? p.stops.map((s) => [s.offset, s.color]) : [], opacity: p.opacity ?? 1,
    ...('color' in p ? { color: p.color } : {}),
  };
};

/** What the kit paints each leaf with, in draw order: an `'inherit'` takes the nearest container's. */
function model(specs: readonly Spec[], up: { fill: Fill | null; stroke: Stroke | null } = { fill: null, stroke: null }): unknown[] {
  return specs.flatMap((s) => {
    const f = s.fill === INHERIT ? up.fill : s.fill ?? null;
    const k = s.stroke === INHERIT ? up.stroke : s.stroke ?? null;
    const self = s.group ? [] : [{ fill: paintKey(f?.paint), stroke: k?.paint ? { paint: paintKey(k.paint), width: k.width ?? 1, cap: k.cap ?? 'butt', dash: k.dash ?? [] } : 'none' }];
    return [...self, ...model(s.children, { fill: f, stroke: k })];
  });
}

const svgKey = (p: SvgPaint, extra?: number): unknown => {
  if (p.kind === 'none') return 'none';
  if (p.kind === 'solid') return { color: p.color, opacity: extra ?? p.opacity ?? 1 };
  return paintKey({ ...p.paint, ...(extra !== undefined ? { opacity: extra } : {}) });
};

function read(nodes: readonly SvgNode[]): unknown[] {
  return nodes.flatMap((n): unknown[] => {
    if (n.kind === 'group') return read(n.children);
    if (n.kind !== 'path') return [];
    const w = n.stroke && (typeof n.stroke.width === 'number' ? n.stroke.width : n.stroke.width.px);
    return [{ fill: svgKey(n.fill), stroke: n.stroke && n.stroke.paint.kind !== 'none' ? { paint: svgKey(n.stroke.paint, n.stroke.opacity), width: w, cap: n.stroke.cap ?? 'butt', dash: n.stroke.dash ?? [] } : 'none' }];
  });
}

describe('svgNodesFromKit through serialize and parse, property', () => {
  it('paints every leaf as the kit resolves it, inherited fills and strokes included', () => {
    let inherited = 0, leaves = 0;
    fc.assert(fc.property(fc.array(spec, { minLength: 1, maxLength: 3 }), (specs) => {
      const want = model(specs);
      const xml = serializeSvg(svgNodesFromKit(treeOf(specs)));
      const out = parseSvg(xml);
      expect(out.warnings, xml).toEqual([]);
      expect(read(out.nodes), xml).toEqual(want);
      leaves += want.length;
      inherited += (xml.match(/<g [^>]*fill=/g) ?? []).length;
    }), runs(N));
    expect(leaves).toBeGreaterThan(runs(N).numRuns * 2);
    expect(inherited).toBeGreaterThan(runs(N).numRuns / 5);
  }, timeoutFor(N, 30));
});
