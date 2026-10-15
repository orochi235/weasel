/** Test helper: what a built diagram's routed wires run through and across. */
import { pointAlongPath, type Vec2 } from '@weasel-js/core';
import { EDGE_DERIVE_PATH } from '../edge';
import { LABEL_DERIVE_POSE } from '../label';
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
    const [from, to] = (spec.dependsOn ?? []) as readonly string[];
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

/** Ids of the edge labels that overlap a node's box, or that a wire other than
 *  their own runs through. */
export function labelsInTheWay(data: DiagramData, specs: readonly DiagramSpec[]): string[] {
  const byId = new Map(specs.map((s) => [s.id as string, s]));
  const wires = routedWires(specs);
  const out: string[] = [];
  for (const spec of specs) {
    if (spec.derivePose !== LABEL_DERIVE_POSE) continue;
    const edgeId = (spec.dependsOn as readonly string[])[0]!;
    const edge = byId.get(edgeId)!;
    const [from, to] = edge.dependsOn as readonly string[];
    const ends = [byId.get(from!)!, byId.get(to!)!];
    const path = EDGE_DERIVE_PATH(edge as never, ends.map((n) => ({ node: n, pose: n.pose })) as never);
    const box = LABEL_DERIVE_POSE(spec as never, [{ node: edge, pose: edge.pose, path }] as never) as Rect | null;
    if (box === null) continue;
    const onBox = data.nodes.some((n) => {
      const r = byId.get(n.id)?.pose as Rect | undefined;
      return r !== undefined && overlap(box, r, 1);
    });
    const crossed = wires.some((w) => w.id !== edgeId && w.points.some((p) => inside(p, box, 1)));
    if (onBox || crossed) out.push(spec.id as string);
  }
  return out;
}

const overlap = (a: Rect, b: Rect, inset: number) =>
  a.x + inset < b.x + b.width && b.x + inset < a.x + a.width && a.y + inset < b.y + b.height && b.y + inset < a.y + a.height;

function membersOf(data: DiagramData, group: string): string[] {
  const g = (data.groups ?? []).find((x) => x.id === group);
  if (g === undefined) return [];
  return g.members.flatMap((m) => [m, ...membersOf(data, m)]);
}

/** Where segments `p1p2` and `p3p4` cross, or `null`. */
function crossing(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): Vec2 | null {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (d === 0) return null;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  if (!(t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6)) return null;
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}

/** Pairs of wires that cross, leaving out where two wires meet at a port they
 *  share. Two wires into one node's different ports count when they cross on
 *  the way in. */
export function crossingPairs(specs: readonly DiagramSpec[]): number {
  const wires = routedWires(specs);
  const ends = (w: Wire) => [w.points[0]!, w.points[w.points.length - 1]!];
  const near = (p: Vec2, q: Vec2) => Math.hypot(p.x - q.x, p.y - q.y) < 2;
  let n = 0;
  for (let i = 0; i < wires.length; i++) {
    for (let j = i + 1; j < wires.length; j++) {
      const a = wires[i]!;
      const b = wires[j]!;
      const shared = ends(a).filter((p) => ends(b).some((q) => near(p, q)));
      let hit = false;
      for (let x = 0; x < a.points.length - 1 && !hit; x++) {
        for (let y = 0; y < b.points.length - 1 && !hit; y++) {
          const at = crossing(a.points[x]!, a.points[x + 1]!, b.points[y]!, b.points[y + 1]!);
          if (at !== null && !shared.some((p) => near(p, at))) hit = true;
        }
      }
      if (hit) n++;
    }
  }
  return n;
}
