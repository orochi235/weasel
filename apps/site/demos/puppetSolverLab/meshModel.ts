/**
 * What the lab draws from a puppet-warped node: its mesh at one solver stage,
 * placed in world space, each triangle's area ratio, and the stretches of
 * outline whose triangle has turned over.
 */
import type { EditableShape } from '@weasel-js/core';
import { applyToPoint } from '@weasel-js/geom';
import { resolvePathWarp } from '@weasel-js/path-tools';
import { solveStages } from './solverStages';

export type Stage = 'step1' | 'step2';

export interface MeshModel {
  triangles: Uint32Array;
  /** Vertex positions at the stage shown, in world space. */
  world: Float64Array;
  /** Each triangle's signed area at the stage shown over its area at rest; at or below 0 it has turned over. */
  ratio: Float64Array;
  /** Outline edges, as vertex pairs in the triangle's winding, with the triangle owning each. */
  outline: { a: number; b: number; tri: number }[];
  inverted: number;
  invertedOnOutline: number;
}

const doubleArea = (P: ArrayLike<number>, a: number, b: number, c: number) =>
  (P[2 * b] - P[2 * a]) * (P[2 * c + 1] - P[2 * a + 1]) - (P[2 * b + 1] - P[2 * a + 1]) * (P[2 * c] - P[2 * a]);

/** Edges only one triangle has: the outline, holes included. */
function outlineOf(T: Uint32Array, n: number): { a: number; b: number; tri: number }[] {
  const count = new Map<number, number>();
  const key = (a: number, b: number) => Math.min(a, b) * n + Math.max(a, b);
  for (let i = 0; i < T.length; i++) {
    const k = key(T[i], T[i - (i % 3) + ((i % 3) + 1) % 3]);
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  const out: { a: number; b: number; tri: number }[] = [];
  for (let t = 0; t < T.length / 3; t++) {
    for (let e = 0; e < 3; e++) {
      const a = T[3 * t + e], b = T[3 * t + (e + 1) % 3];
      if (count.get(key(a, b)) === 1) out.push({ a, b, tri: t });
    }
  }
  return out;
}

const outlines = new WeakMap<Uint32Array, { a: number; b: number; tri: number }[]>();

/** The mesh `node`'s puppet warp deforms, at `stage`, or null when it holds no puppet warp. */
export function meshModelOf(node: EditableShape | null | undefined, stage: Stage): MeshModel | null {
  const resolved = resolvePathWarp(node);
  if (!resolved || resolved.held.warp.kind !== 'puppet') return null;
  const stages = solveStages(resolved.held.source, resolved.held.warp.pins);
  if (!stages) return null;
  const at = (stage === 'step1' ? stages.step1 : null) ?? stages.step2;
  const { vertices: V, triangles: T } = stages.mesh;
  const n = V.length >> 1;
  let outline = outlines.get(T);
  if (!outline) { outline = outlineOf(T, n); outlines.set(T, outline); }
  const world = new Float64Array(2 * n);
  for (let i = 0; i < n; i++) {
    const [x, y] = applyToPoint(resolved.toWorld, at[2 * i], at[2 * i + 1]);
    world[2 * i] = x; world[2 * i + 1] = y;
  }
  const ratio = new Float64Array(T.length / 3);
  let inverted = 0;
  for (let t = 0; t < ratio.length; t++) {
    const a = T[3 * t], b = T[3 * t + 1], c = T[3 * t + 2];
    const rest = doubleArea(V, a, b, c);
    ratio[t] = rest === 0 ? 1 : doubleArea(at, a, b, c) / rest;
    if (ratio[t] <= 0) inverted++;
  }
  const flipped = new Set(outline.filter((e) => ratio[e.tri] <= 0).map((e) => e.tri));
  return { triangles: T, world, ratio, outline, inverted, invertedOnOutline: flipped.size };
}
