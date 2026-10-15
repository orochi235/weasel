/** Test helper: what a built diagram's routed wires run through and across. */
import { pointAlongPath, type Vec2 } from '@weasel-js/core';
import { EDGE_DERIVE_PATH } from '../edge';
import type { DiagramData, DiagramSpec } from '../fromData';

type Rect = { x: number; y: number; width: number; height: number };

interface Wire {
  id: string;
  from: string;
  to: string;
  points: Vec2[];
}

const SAMPLES = 96;

/** Every edge's routed path, sampled, as `diagramScene` would draw it. */
export function routedWires(specs: readonly DiagramSpec[]): Wire[] {
  const byId = new Map(specs.map((s) => [s.id as string, s]));
  const wires: Wire[] = [];
  for (const spec of specs) {
    if (spec.derivePath !== EDGE_DERIVE_PATH) continue;
    const [from, to] = (spec.dependsOn ?? []) as string[];
    const a = byId.get(from!);
    const b = byId.get(to!);
    if (a === undefined || b === undefined) continue;
    const path = EDGE_DERIVE_PATH(spec as never, [{ node: a, pose: a.pose }, { node: b, pose: b.pose }] as never);
    if (path === null) continue;
    const points: Vec2[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const at = pointAlongPath(path, i / SAMPLES);
      if (at !== null) points.push(at.point);
    }
    wires.push({ id: spec.id as string, from: from!, to: to!, points });
  }
  return wires;
}

const inside = (p: Vec2, r: Rect, inset: number) =>
  p.x > r.x + inset && p.x < r.x + r.width - inset && p.y > r.y + inset && p.y < r.y + r.height - inset;

/** Ids of the wires that pass through a node's box they do not join, or a
 *  group's box when neither end is inside that group. */
export function wiresThroughBoxes(data: DiagramData, specs: readonly DiagramSpec[]): string[] {
  const byId = new Map(specs.map((s) => [s.id as string, s]));
  const boxOf = (id: string) => byId.get(id)?.pose as Rect | undefined;
  const members = new Map((data.groups ?? []).map((g) => [g.id, new Set(membersOf(data, g.id))]));
  const out: string[] = [];
  for (const wire of routedWires(specs)) {
    const obstacles: Rect[] = [];
    for (const n of data.nodes) {
      if (n.id === wire.from || n.id === wire.to) continue;
      const box = boxOf(n.id);
      if (box) obstacles.push(box);
    }
    for (const [g, inGroup] of members) {
      if (g === wire.from || g === wire.to || inGroup.has(wire.from) || inGroup.has(wire.to)) continue;
      const box = boxOf(g);
      if (box) obstacles.push(box);
    }
    if (wire.points.some((p) => obstacles.some((r) => inside(p, r, 1)))) out.push(wire.id);
  }
  return out;
}

function membersOf(data: DiagramData, group: string): string[] {
  const g = (data.groups ?? []).find((x) => x.id === group);
  if (g === undefined) return [];
  return g.members.flatMap((m) => [m, ...membersOf(data, m)]);
}

function crosses(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): boolean {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (d === 0) return false;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6;
}

/** Pairs of wires that cross, leaving out pairs that share an end. */
export function crossingPairs(specs: readonly DiagramSpec[]): number {
  const wires = routedWires(specs);
  let n = 0;
  for (let i = 0; i < wires.length; i++) {
    for (let j = i + 1; j < wires.length; j++) {
      const a = wires[i]!;
      const b = wires[j]!;
      if (a.from === b.from || a.from === b.to || a.to === b.from || a.to === b.to) continue;
      let hit = false;
      for (let x = 0; x < a.points.length - 1 && !hit; x++) {
        for (let y = 0; y < b.points.length - 1 && !hit; y++) {
          if (crosses(a.points[x]!, a.points[x + 1]!, b.points[y]!, b.points[y + 1]!)) hit = true;
        }
      }
      if (hit) n++;
    }
  }
  return n;
}
