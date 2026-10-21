/**
 * Finishing an edit of constrained paths so their constraints hold: one path
 * on its own, or several solved together when links — constraints naming
 * anchors of more than one — tie them.
 */

import type { PolygonPath } from '../path';
import type { PointOrigin } from '../paths/anchorOrigins';
import { unsatisfiedConstraints } from './check';
import {
  anchorsBefore, pathAnchorPoints, remapConstraints, segmentBetween, withAnchorPoints,
} from './pathConstraints';
import type { ConstraintPoint, HandleRef } from './points';
import { solveConstraints } from './solve';
import { mapConstraintAnchors, type PathConstraint } from './types';

/** Options for {@link constrainPathEdit}. */
export interface ConstrainPathEditOptions {
  /**
   * Where each point of the edited path came from, as `editAnchorSetTracked`
   * answers. Absent, the edit is taken to keep every anchor's number, and one
   * that changes the anchor count drops every constraint.
   */
  origins?: readonly (PointOrigin | null)[];
  /** See {@link SolveConstraintsOptions.axisAngle}. */
  axisAngle?: number;
}

/** What {@link constrainPathEdit} answers. */
export interface ConstrainedPathEdit {
  /** The edited path with the constraints holding again. */
  path: PolygonPath;
  /** The constraints renumbered for `path`'s anchors. */
  constraints: PathConstraint[];
  /** Whether every constraint that held before the edit holds after it. */
  converged: boolean;
  /** Indices into `constraints` of the ones that do not hold, including any that already did not before the edit. */
  unsatisfied: number[];
}

/** One path of a {@link constrainPathsEdit}: its edit, and its own constraints. */
export interface PathsEditItem extends ConstrainPathEditOptions {
  before: PolygonPath;
  /** `before` as the edit left it; `before` itself for a path the edit did not touch. */
  after: PolygonPath;
  constraints: readonly PathConstraint[];
  /** For a path the edit left alone: its anchors give way as freely as any the edit did not move, rather than only when the edited paths cannot. */
  yields?: boolean;
}

/**
 * A constraint across paths. Its anchors are numbered over the anchors of
 * `paths` — indices into the items — one after another in that order: with
 * `paths: [2, 0]` and a 5-anchor item 2, anchor 6 is item 0's anchor 1. Its
 * `horizontal` and `vertical` read the world's axes.
 */
export interface PathLink {
  constraint: PathConstraint;
  paths: readonly number[];
}

/** What {@link constrainPathsEdit} answers. */
export interface ConstrainedPathsEdit {
  /** Each item, in order: its path with the constraints holding, and its own constraints renumbered for it. */
  items: { path: PolygonPath; constraints: PathConstraint[]; unsatisfied: number[] }[];
  /** Each link renumbered over its paths' anchors after the edit; null when the edit removed an anchor it names. */
  links: { constraint: PathConstraint | null; satisfied: boolean }[];
  /** Whether every constraint that held before the edit holds after it. */
  converged: boolean;
}

/** The handles of `now` turned or stretched from where their anchors' `reference` had them. */
function handlesMoved(now: readonly ConstraintPoint[], reference: readonly (ConstraintPoint | undefined)[]): HandleRef[] {
  const offset = (p: ConstraintPoint, h: { x: number; y: number } | undefined) => h && { x: h.x - p.x, y: h.y - p.y };
  // Translating an anchor moves its handles by the same amount, which can round their offsets.
  const near = (a?: { x: number; y: number }, b?: { x: number; y: number }) =>
    a === b || (!!a && !!b && Math.abs(a.x - b.x) <= 1e-9 * (1 + Math.abs(a.x)) && Math.abs(a.y - b.y) <= 1e-9 * (1 + Math.abs(a.y)));
  return now.flatMap((p, anchor) => {
    const r = reference[anchor];
    if (!r) return [];
    const sides: HandleRef[] = [];
    if (!near(offset(p, p.inHandle), offset(r, r.inHandle))) sides.push({ anchor, side: 'in' });
    if (!near(offset(p, p.outHandle), offset(r, r.outHandle))) sides.push({ anchor, side: 'out' });
    return sides;
  });
}

const starts = (counts: readonly number[]) => counts.reduce<number[]>((acc, n, i) => [...acc, acc[i] + n], [0]);

/** Link anchor `a`, numbered over `paths` with `counts`, as a global index, given each item's `offsets`. */
function linkToGlobal(link: PathLink, counts: readonly number[], offsets: readonly number[]) {
  const local = starts(link.paths.map((p) => counts[p]));
  return (a: number): number | undefined => {
    for (let k = 0; k < link.paths.length; k++) {
      if (a >= local[k] && a < local[k + 1]) return offsets[link.paths[k]] + a - local[k];
    }
    return undefined;
  };
}

/** Global index `g` as an item and its anchor there. */
function itemOf(g: number, offsets: readonly number[]): { item: number; anchor: number } {
  let item = 0;
  while (item + 1 < offsets.length - 1 && g >= offsets[item + 1]) item++;
  return { item, anchor: g - offsets[item] };
}

/**
 * An edit of constrained paths, finished so their constraints and the links
 * between them hold, as one solve over every anchor: the anchors and handles
 * the edit moved are held, and so are the anchors of a path it left alone
 * (`after === before`), except one held on a segment or on a path that
 * `yields`; `fixed` anchors go
 * back to where they were, and the rest move the least they must. A constraint
 * that did not hold before the edit is left out of the solve, and reported.
 * Each item's own `horizontal` and `vertical` read its own `axisAngle`.
 */
export function constrainPathsEdit(items: readonly PathsEditItem[], links: readonly PathLink[] = []): ConstrainedPathsEdit {
  const was = items.map((it) => pathAnchorPoints(it.before));
  const now = items.map((it) => pathAnchorPoints(it.after));
  const wasStart = starts(was.map((p) => p.length));
  const nowStart = starts(now.map((p) => p.length));
  const wasAnchor = items.flatMap((it, i) => {
    const map = it.origins
      ? anchorsBefore(it.before, it.after, it.origins)
      : now[i].map((_, j) => (now[i].length === was[i].length ? j : undefined));
    return map.map((old) => (old === undefined ? undefined : wasStart[i] + old));
  });

  // Every constraint numbered over all the anchors before the edit, the items' own first.
  const all: PathConstraint[] = [];
  const angles: (number | undefined)[] = [];
  items.forEach((it, i) => it.constraints.forEach((c) => {
    all.push(mapConstraintAnchors(c, (a) => wasStart[i] + a)!);
    angles.push(it.axisAngle);
  }));
  const ownCount = all.length;
  for (const link of links) {
    all.push(mapConstraintAnchors(link.constraint, linkToGlobal(link, was.map((p) => p.length), wasStart))
      ?? { kind: 'fixed', anchor: -1 });
    angles.push(0);
  }

  const wasAll = was.flat();
  const nowAll = now.flat();
  const broken = new Set(unsatisfiedConstraints(wasAll, all, { axisAngles: angles }));
  // An `onPath` whose segment the edit split or broke has no segment left to hold its anchor on.
  const remapped = remapConstraints(all, wasAnchor);
  const joined = remapped.constraints.map((c) => {
    if (c.kind !== 'onPath') return true;
    const [a, b] = c.segment.map((g) => itemOf(g, nowStart));
    return a.item === b.item && !!segmentBetween(items[a.item].after, a.anchor, b.anchor);
  });
  const kept = remapped.constraints.filter((_, i) => joined[i]);
  const from = remapped.from.filter((_, i) => joined[i]);
  const skip = from.flatMap((old, i) => (broken.has(old) ? [i] : []));
  const reference = wasAnchor.map((old) => (old === undefined ? undefined : wasAll[old]));
  // A path the edit left alone gives way only when the edited ones cannot, but an anchor held
  // on a segment still follows the segment.
  const sliding = new Set(kept.flatMap((c) => (c.kind === 'onPath' ? [c.anchor] : [])));
  const still = (i: number) => {
    const { item } = itemOf(i, nowStart);
    const it = items[item];
    return items.length > 1 && it.before === it.after && !it.yields && !sliding.has(i);
  };
  const held = nowAll.flatMap((p, i) => {
    const r = reference[i];
    return !r || r.x !== p.x || r.y !== p.y || still(i) ? [i] : [];
  });
  const solved = solveConstraints(nowAll, kept, {
    held, heldHandles: handlesMoved(nowAll, reference), reference, skip, axisAngles: from.map((old) => angles[old]),
  });
  const failing = new Set(solved.unsatisfied);

  const outItems: ConstrainedPathsEdit['items'] = items.map((it, i) => ({
    path: withAnchorPoints(it.after, now[i], solved.points.slice(nowStart[i], nowStart[i + 1])),
    constraints: [],
    unsatisfied: [],
  }));
  const outLinks: ConstrainedPathsEdit['links'] = links.map(() => ({ constraint: null, satisfied: false }));
  kept.forEach((c, k) => {
    const old = from[k];
    if (old < ownCount) {
      const { item } = itemOf(constraintFirstAnchor(all[old]), wasStart);
      const out = outItems[item];
      if (failing.has(k)) out.unsatisfied.push(out.constraints.length);
      out.constraints.push(mapConstraintAnchors(c, (g) => g - nowStart[item])!);
      return;
    }
    const link = links[old - ownCount];
    const local = starts(link.paths.map((p) => now[p].length));
    const toLocal = (g: number) => {
      const { item, anchor } = itemOf(g, nowStart);
      const k2 = link.paths.indexOf(item);
      return k2 < 0 ? undefined : local[k2] + anchor;
    };
    outLinks[old - ownCount] = { constraint: mapConstraintAnchors(c, toLocal), satisfied: !failing.has(k) };
  });
  return { items: outItems, links: outLinks, converged: solved.converged };
}

function constraintFirstAnchor(c: PathConstraint): number {
  switch (c.kind) {
    case 'fixed':
    case 'tangent':
    case 'onPath': return c.anchor;
    case 'horizontal':
    case 'vertical':
    case 'length': return c.segment[0];
    case 'coincident': return c.anchors[0];
    default: return c.segments[0][0];
  }
}

/**
 * An edit of a constrained path, `before` → `after`, finished so its
 * constraints hold: the anchors and handles the edit moved are held, `fixed`
 * anchors go back to where they were, and the rest move the least they must.
 * A constraint that did not hold before the edit conflicts with the others
 * and is left out of the solve rather than allowed to pull them out of true;
 * `unsatisfied` reports it.
 */
export function constrainPathEdit(
  before: PolygonPath,
  after: PolygonPath,
  constraints: readonly PathConstraint[],
  opts: ConstrainPathEditOptions = {},
): ConstrainedPathEdit {
  const done = constrainPathsEdit([{ before, after, constraints, ...opts }]);
  const [item] = done.items;
  return { path: item.path, constraints: item.constraints, converged: done.converged, unsatisfied: item.unsatisfied };
}
