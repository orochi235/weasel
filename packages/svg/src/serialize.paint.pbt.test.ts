/**
 * The exporter draws what it was given: each leaf's fill, stroke, opacity, clips, and visibility through
 * `serializeSvg` and `parseSvg`. Geometry has its own property in `roundtrip.geometry.pbt.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { boundsOfPath, multiply, transformPath, type Affine, type Path } from '@weasel-js/geom';
import type { Paint } from '@weasel-js/core';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import { IDENTITY_MATRIX, type SvgNode, type SvgPaint, type SvgStroke } from './types';
import { isOpen, runs, timeoutFor, tree } from './pbt.fixture';

const N = 120;

const scaleOf = (m: Affine): number => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));

interface Drawn {
  fill: unknown;
  stroke: unknown;
  opacity: number;
  clips: number[][];
  hidden: boolean;
}
/** `got` deep-equal to `want`, numbers within 1e-3 of each other relatively: a written matrix keeps six decimals. */
function expectClose(got: unknown, want: unknown, at: string): void {
  if (typeof want === 'number' && typeof got === 'number') {
    expect(Math.abs(got - want), `${at}: ${got} vs ${want}`).toBeLessThanOrEqual(1e-3 * Math.max(1, Math.abs(want)));
    return;
  }
  if (want === null || typeof want !== 'object' || got === null || typeof got !== 'object') {
    expect(got, at).toEqual(want);
    return;
  }
  expect(Object.keys(got).sort(), at).toEqual(Object.keys(want).sort());
  for (const k of Object.keys(want)) {
    expectClose((got as Record<string, unknown>)[k], (want as Record<string, unknown>)[k], `${at}.${k}`);
  }
}

function paintKey(p: SvgPaint | undefined, extraOpacity?: number): unknown {
  if (!p || p.kind === 'none') return 'none';
  if (p.kind === 'solid') return { color: p.color, opacity: ((extraOpacity ?? p.opacity ?? 1)) };
  const g: Paint = p.paint;
  return {
    kind: g.kind, stops: 'stops' in g ? g.stops.map((s) => [(s.offset), s.color]) : [], opacity: (extraOpacity ?? g.opacity ?? 1),
    ...('color' in g && g.kind !== 'solid' && g.kind !== undefined ? { color: g.color } : {}),
  };
}

function strokeKey(s: SvgStroke | undefined, m: Affine, closed: boolean): unknown {
  if (!s || s.paint.kind === 'none') return 'none';
  const k = scaleOf(m);
  const w = typeof s.width === 'number' ? s.width : s.width.px;
  return {
    paint: paintKey(s.paint, s.opacity),
    width: (w * k),
    cap: s.cap ?? 'butt', join: s.join ?? 'miter', miterLimit: (s.miterLimit ?? 4),
    // An odd-length list repeats to an even one, SVG's reading of it.
    dash: (s.dash && s.dash.length % 2 === 1 ? [...s.dash, ...s.dash] : s.dash ?? []).map((d) => (d * k)), dashOffset: s.dash?.length ? ((s.dashOffset ?? 0) * k) : 0,
    markers: [closed ? undefined : markerName(s.markerStart), closed ? undefined : markerName(s.markerEnd)],
  };
}

/** A marker reference by the built-in it is: a read-back key is that name and a hash. */
function markerName(ref: SvgStroke['markerStart']): string | undefined {
  if (ref === undefined) return undefined;
  const key = typeof ref === 'string' ? ref : ref.key;
  return key.replace(/-[0-9a-z]{4,}$/, '');
}

const box = (p: Path): number[] => {
  const b = boundsOfPath(p);
  return [b.x, b.y, b.x + b.width, b.y + b.height];
};

/** Each leaf as it is drawn: paints, its opacity times every group's, the world box of each clip above it. */
function drawn(nodes: readonly SvgNode[], parsed: boolean, m: Affine = IDENTITY_MATRIX, o = 1, clips: number[][] = [], hidden = false): Drawn[] {
  return nodes.flatMap((n): Drawn[] => {
    const h = hidden || n.hidden === true;
    if (n.kind === 'group') {
      const mm = !parsed && n.transform ? multiply(m, n.transform) : m;
      const c = n.clip ? [...clips, box(parsed ? n.clip : transformPath(n.clip, mm))] : clips;
      return drawn(n.children, parsed, mm, o * (n.opacity ?? 1), c, h);
    }
    if (n.kind !== 'path') return [];
    const closed = !isOpen(n.path);
    return [{
      fill: paintKey(n.fill), stroke: strokeKey(n.stroke, parsed ? IDENTITY_MATRIX : m, closed),
      opacity: (o * (n.opacity ?? 1)), clips, hidden: h,
    }];
  });
}

describe('serializeSvg, property', () => {
  it('draws what it was given: every leaf keeps its paints, opacity, clips, and visibility', () => {
    let leaves = 0;
    fc.assert(fc.property(tree(), (nodes) => {
      const xml = serializeSvg(nodes);
      const back = parseSvg(xml, { keepHidden: true });
      const want = drawn(nodes, false), got = drawn(back.nodes, true);
      expectClose(got, want, xml);
      leaves += want.length;
    }), runs(N));
    expect(leaves).toBeGreaterThan(runs(N).numRuns * 2);
  }, timeoutFor(N, 40));
});
