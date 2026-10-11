/**
 * What a group adds to the relaxation in `force.ts`: its members drawn
 * together, and its box kept clear of everything that is not in it.
 *
 * A group is its members and nothing else here — the box is recomputed from
 * where they are on every tick, the way the scene derives it: around its own
 * nodes and the boxes of the groups nested in it.
 */
import type { SimulationForce } from '@weasel-js/core/math';
import type { GraphGroup } from './graph';
import type { ForceBody } from './force';

interface GroupBodies {
  /** Every body inside, through any nested group. */
  members: ForceBody[];
  group: GraphGroup;
  parent?: GroupBodies;
  children: GroupBodies[];
}

interface Box { x0: number; y0: number; x1: number; y1: number }

function resolve(groups: readonly GraphGroup[], byId: ReadonlyMap<string, ForceBody>): GroupBodies[] {
  const out: GroupBodies[] = [];
  for (const group of groups) {
    const members = group.members.map((id) => byId.get(id)).filter((b) => b !== undefined);
    if (members.length > 0) out.push({ members, group, children: [] });
  }
  const byGroup = new Map(out.map((g) => [g.group.id, g]));
  for (const g of out) {
    const parent = g.group.parent === undefined ? undefined : byGroup.get(g.group.parent);
    if (parent === undefined) continue;
    g.parent = parent;
    parent.children.push(g);
  }
  return out;
}

/** A pull on each member toward its group's centroid. */
export function groupCohesion(
  groups: readonly GraphGroup[],
  byId: ReadonlyMap<string, ForceBody>,
  strength: number,
): SimulationForce<ForceBody> {
  const resolved = resolve(groups, byId);
  return (alpha) => {
    for (const { members } of resolved) {
      let cx = 0;
      let cy = 0;
      for (const m of members) {
        cx += m.x;
        cy += m.y;
      }
      cx /= members.length;
      cy /= members.length;
      for (const m of members) {
        m.vx! += (cx - m.x) * strength * alpha;
        m.vy! += (cy - m.y) * strength * alpha;
      }
    }
  };
}

/** The box of `g`: around its bodies and its nested groups' boxes, grown by
 *  its inset. A body inside a nested group is covered by that group's box. */
function boxOf(g: GroupBodies): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const m of g.members) {
    x0 = Math.min(x0, m.x - m.hw);
    y0 = Math.min(y0, m.y - m.hh);
    x1 = Math.max(x1, m.x + m.hw);
    y1 = Math.max(y1, m.y + m.hh);
  }
  for (const child of g.children) {
    const b = boxOf(child);
    x0 = Math.min(x0, b.x0);
    y0 = Math.min(y0, b.y0);
    x1 = Math.max(x1, b.x1);
    y1 = Math.max(y1, b.y1);
  }
  const { inset } = g.group;
  return { x0: x0 - inset.left, y0: y0 - inset.top, x1: x1 + inset.right, y1: y1 + inset.bottom };
}

/** How far `b` has to move to clear `a` by `padding`, along whichever axis is
 *  shorter, or `null` when they are already clear. */
function clearance(a: Box, b: Box, padding: number): { x: number; y: number } | null {
  const gapX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + padding;
  const gapY = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) + padding;
  if (gapX <= 0 || gapY <= 0) return null;
  const dx = (b.x0 + b.x1) - (a.x0 + a.x1);
  const dy = (b.y0 + b.y1) - (a.y0 + a.y1);
  return gapX < gapY
    ? { x: (Math.sign(dx) || 1) * gapX, y: 0 }
    : { x: 0, y: (Math.sign(dy) || 1) * gapY };
}

/** Whether `inner` is nested somewhere inside `outer`. */
function holds(outer: GroupBodies, inner: GroupBodies): boolean {
  for (let at = inner.parent; at !== undefined; at = at.parent) {
    if (at === outer) return true;
  }
  return false;
}

function shove(bodies: readonly ForceBody[], x: number, y: number): void {
  for (const body of bodies) {
    body.vx! += x;
    body.vy! += y;
  }
}

/**
 * Push a group's box clear of every other group's and of every body outside
 * it, moving the group as a block. Like the box separation between nodes it is
 * not scaled by alpha: an overlap at the end of the run is as wrong as one at
 * the start.
 */
export function separateGroups(
  groups: readonly GraphGroup[],
  bodies: readonly ForceBody[],
  byId: ReadonlyMap<string, ForceBody>,
  padding: number,
): SimulationForce<ForceBody> {
  const resolved = resolve(groups, byId);
  const memberSets = resolved.map((g) => new Set(g.members));
  return () => {
    const boxes = resolved.map(boxOf);
    for (let i = 0; i < resolved.length; i++) {
      for (let j = i + 1; j < resolved.length; j++) {
        if (holds(resolved[i]!, resolved[j]!) || holds(resolved[j]!, resolved[i]!)) continue;
        const push = clearance(boxes[i]!, boxes[j]!, padding);
        if (push === null) continue;
        shove(resolved[i]!.members, -push.x / 2, -push.y / 2);
        shove(resolved[j]!.members, push.x / 2, push.y / 2);
      }
      for (const body of bodies) {
        if (memberSets[i]!.has(body)) continue;
        const box = { x0: body.x - body.hw, y0: body.y - body.hh, x1: body.x + body.hw, y1: body.y + body.hh };
        const push = clearance(boxes[i]!, box, padding);
        if (push === null) continue;
        shove(resolved[i]!.members, -push.x / 2, -push.y / 2);
        body.vx! += push.x / 2;
        body.vy! += push.y / 2;
      }
    }
  };
}
