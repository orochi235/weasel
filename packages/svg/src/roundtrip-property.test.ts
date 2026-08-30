/**
 * Round-trip property: once a tree has been through parse → serialize, going
 * round again must produce byte-identical SVG. The first pass is excluded
 * because parsing is lossy by design (a group's `transform` collapses onto
 * its descendants); everything after it has to be a fixed point, and anything
 * that isn't — a dropped attribute, a paint that re-ids, a coordinate that
 * drifts — shows up as a diff.
 *
 * Trees are generated from a seeded PRNG so a failure names a reproducible
 * seed rather than a flake.
 */

import { describe, it, expect } from 'vitest';
import { PathBuilder, type FillStyle } from '@weasel-js/core';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import type { SvgNode, SvgPaint, SvgStroke } from './types';

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const COLORS = ['#000000', '#ff0000', '#00ff00', '#3366cc', '#ffffff'];

function makeTree(seed: number): SvgNode[] {
  const r = rng(seed);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
  const coord = (): number => Math.round(r() * 4000 - 2000) / 10;

  const gradient = (): FillStyle => (r() < 0.5
    ? {
      fill: 'linear-gradient',
      from: { x: coord(), y: coord() },
      to: { x: coord(), y: coord() },
      stops: [{ offset: 0, color: pick(COLORS) }, { offset: 1, color: pick(COLORS) }],
      units: pick(['bounds', 'world'] as const),
    }
    : {
      fill: 'radial-gradient',
      center: { x: coord(), y: coord() },
      radius: Math.abs(coord()) + 1,
      stops: [{ offset: 0.25, color: pick(COLORS) }, { offset: 1, color: pick(COLORS) }],
      units: pick(['bounds', 'world'] as const),
    });

  const paint = (): SvgPaint => {
    const roll = r();
    if (roll < 0.15) return { kind: 'none' };
    if (roll < 0.35) return { kind: 'gradient', paint: gradient() };
    const out: SvgPaint = { kind: 'solid', color: pick(COLORS) };
    if (r() < 0.4) (out as { opacity?: number }).opacity = Math.round(r() * 10) / 10;
    return out;
  };

  const stroke = (): SvgStroke | undefined => {
    if (r() < 0.4) return undefined;
    const p = paint();
    if (p.kind === 'none') return undefined;
    const s: SvgStroke = { paint: p, width: Math.round(r() * 100) / 10 };
    if (r() < 0.5) s.cap = pick(['butt', 'round', 'square'] as const);
    if (r() < 0.5) s.join = pick(['miter', 'round', 'bevel'] as const);
    if (r() < 0.3) s.dash = [Math.round(r() * 50) / 10, Math.round(r() * 50) / 10];
    if (r() < 0.3) s.miterLimit = 1 + Math.round(r() * 100) / 10;
    const MARKER_KEYS = ['arrow', 'arrow-open', 'diamond', 'circle', 'bar'];
    if (r() < 0.3) s.markerStart = pick(MARKER_KEYS);
    if (r() < 0.2) s.markerMid = pick(MARKER_KEYS);
    if (r() < 0.4) s.markerEnd = pick(MARKER_KEYS);
    return s;
  };

  const path = (): SvgNode => {
    const roll = r();
    if (roll < 0.3) {
      const node: SvgNode = {
        kind: 'path',
        path: {
          kind: 'rect',
          x: coord(), y: coord(),
          width: Math.abs(coord()) + 1, height: Math.abs(coord()) + 1,
        },
        fill: paint(),
      };
      const s = stroke();
      if (s) node.stroke = s;
      return node;
    }
    const b = new PathBuilder();
    b.moveTo(coord(), coord());
    b.lineTo(coord(), coord());
    b.curveTo(coord(), coord(), coord(), coord(), coord(), coord());
    b.quadTo(coord(), coord(), coord(), coord());
    if (r() < 0.5) b.close();
    const built = b.build();
    const node: SvgNode = {
      kind: 'path',
      path: r() < 0.3 ? { ...built, fillRule: 'evenodd' } : built,
      fill: paint(),
    };
    const s = stroke();
    if (s) node.stroke = s;
    if (r() < 0.4) node.rotation = Math.round(r() * 6000) / 1000;
    if (r() < 0.3) node.opacity = Math.round(r() * 10) / 10;
    return node;
  };

  const text = (): SvgNode => {
    const node: SvgNode = {
      kind: 'text',
      x: coord(), y: coord(),
      width: Math.abs(coord()) + 1, height: Math.abs(coord()) + 1,
      text: pick(['Hello', 'one\ntwo', 'a  b', ' padded ', 'Ünïcødé & <tags>']),
    };
    if (r() < 0.6) {
      node.style = {
        fontSize: 8 + Math.round(r() * 400) / 10,
        fontFamily: pick(['Inter', 'Helvetica Neue', 'Times New Roman']),
        ...(r() < 0.5 ? { align: pick(['left', 'center', 'right'] as const) } : {}),
        ...(r() < 0.5 ? { underline: true } : {}),
        ...(r() < 0.4 ? { fill: { fill: 'solid', color: pick(COLORS) } as FillStyle } : {}),
      };
    }
    if (r() < 0.3) node.rotation = Math.round(r() * 6000) / 1000;
    return node;
  };

  const image = (): SvgNode => ({
    kind: 'image',
    href: pick(['https://example.com/a.png', 'data:image/png;base64,iVBORw0KGgo=']),
    x: coord(), y: coord(),
    width: Math.abs(coord()) + 1, height: Math.abs(coord()) + 1,
    ...(r() < 0.3 ? { opacity: 0.5 } : {}),
  });

  const leaf = (): SvgNode => {
    const roll = r();
    return roll < 0.6 ? path() : roll < 0.85 ? text() : image();
  };

  const node = (depth: number): SvgNode => {
    if (depth > 0 && r() < 0.35) {
      const n = 1 + Math.floor(r() * 3);
      const children: SvgNode[] = [];
      for (let i = 0; i < n; i++) children.push(node(depth - 1));
      const g: SvgNode = { kind: 'group', children };
      if (r() < 0.3) g.opacity = Math.round(r() * 10) / 10;
      if (r() < 0.3) g.transform = [1, 0, 0, 1, coord(), coord()];
      return g;
    }
    return leaf();
  };

  const roots: SvgNode[] = [];
  const n = 1 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) roots.push(node(2));
  return roots;
}

/** Serialize, carrying the document-level fields parse hands back. */
function reserialize(svg: string): string {
  const p = parseSvg(svg);
  expect(p.warnings).toEqual([]);
  return serializeSvg(p.nodes, {
    ...(p.viewBox ? { viewBox: p.viewBox } : {}),
    ...(p.width != null ? { width: p.width } : {}),
    ...(p.height != null ? { height: p.height } : {}),
    ...(p.title != null ? { title: p.title } : {}),
  });
}

/**
 * Round every number to 4 decimals before comparing. Path coordinates live in
 * a `Float32Array`, so a value reconstructed from `h`/`v` deltas can land one
 * ULP away — around 1e-6 on a coordinate of a few hundred. Anything a
 * dropped attribute, a re-issued paint id or a mis-composed transform would
 * cause is orders of magnitude larger.
 */
function normalize(svg: string): string {
  return svg.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n) * 1e4) / 1e4));
}

describe('parse ∘ serialize is a fixed point', () => {
  for (let seed = 1; seed <= 40; seed++) {
    it(`seed ${seed}`, () => {
      const once = reserialize(serializeSvg(makeTree(seed)));
      expect(normalize(reserialize(once))).toBe(normalize(once));
    });
  }
});
