/**
 * Anchor selections walked along the path: grown or shrunk by one anchor,
 * every Nth anchor, anchors by kind, and the complement. Each takes the
 * decoded set and a selection as flat indices, and returns a new selection
 * as sorted flat indices; none of them edits the set.
 *
 * "Along the path" means within a subpath: an anchor's neighbors are the
 * anchors before and after it there, and a closed subpath's first and last
 * anchors are neighbors.
 */
import { isAnchorSmooth, type PenAnchor } from './anchors';
import { anchorCount, type AnchorSet } from './anchorEdits';

/** The flat index of each subpath's first anchor. */
function subpathStarts(set: AnchorSet): number[] {
  const starts: number[] = [];
  let base = 0;
  for (const sub of set.anchors) {
    starts.push(base);
    base += sub.length;
  }
  return starts;
}

const sorted = (ids: Iterable<number>): number[] => [...new Set(ids)].sort((a, b) => a - b);

/** The flat indices of the anchors either side of each anchor in `sub`
 *  starting at `base`; a missing neighbor is -1. */
function neighbors(set: AnchorSet, s: number, i: number, base: number): [number, number] {
  const n = set.anchors[s].length;
  const closed = set.closed[s] === true && n > 1;
  const prev = i > 0 ? i - 1 : closed ? n - 1 : -1;
  const next = i < n - 1 ? i + 1 : closed ? 0 : -1;
  return [prev < 0 ? -1 : base + prev, next < 0 ? -1 : base + next];
}

/** `selected` with each selected anchor's neighbors along the path added. */
export function growAnchorSelection(set: AnchorSet, selected: Iterable<number>): number[] {
  const had = new Set(selected);
  const out = new Set(had);
  const starts = subpathStarts(set);
  set.anchors.forEach((sub, s) => {
    for (let i = 0; i < sub.length; i++) {
      if (!had.has(starts[s] + i)) continue;
      for (const k of neighbors(set, s, i, starts[s])) if (k >= 0) out.add(k);
    }
  });
  const total = anchorCount(set);
  return sorted([...out].filter((k) => k >= 0 && k < total));
}

/**
 * `selected` less every anchor at the edge of a selected run: one with a
 * neighbor that is unselected, or none on one side, as an open subpath's ends
 * have. A closed subpath selected all the way round has no edge and stays.
 */
export function shrinkAnchorSelection(set: AnchorSet, selected: Iterable<number>): number[] {
  const had = new Set(selected);
  const out: number[] = [];
  const starts = subpathStarts(set);
  set.anchors.forEach((sub, s) => {
    for (let i = 0; i < sub.length; i++) {
      const flat = starts[s] + i;
      if (!had.has(flat)) continue;
      if (neighbors(set, s, i, starts[s]).every((k) => k >= 0 && had.has(k))) out.push(flat);
    }
  });
  return out;
}

/**
 * Every `n`th anchor along each subpath, counting from its first selected
 * anchor. With nothing selected, every subpath counts from its first anchor;
 * otherwise only subpaths holding a selected anchor take part. A closed
 * subpath is walked once round, so the count does not wrap onto itself.
 */
export function everyNthAnchor(set: AnchorSet, n: number, selected: Iterable<number> = []): number[] {
  const step = Math.max(1, Math.floor(n));
  const had = new Set(selected);
  const starts = subpathStarts(set);
  const out: number[] = [];
  set.anchors.forEach((sub, s) => {
    let from = had.size === 0 ? 0 : -1;
    for (let i = 0; from < 0 && i < sub.length; i++) if (had.has(starts[s] + i)) from = i;
    if (from < 0) return;
    const closed = set.closed[s] === true;
    const reach = closed ? sub.length : sub.length - from;
    for (let k = 0; k < reach; k += step) out.push(starts[s] + ((from + k) % sub.length));
  });
  return sorted(out);
}

/** Every anchor `keep` says yes to. */
export function anchorsWhere(set: AnchorSet, keep: (anchor: PenAnchor) => boolean): number[] {
  const out: number[] = [];
  let flat = 0;
  for (const sub of set.anchors) {
    for (const a of sub) {
      if (keep(a)) out.push(flat);
      flat++;
    }
  }
  return out;
}

/** Every corner anchor: one whose handles are not collinear through it, or
 *  that lacks one (`isAnchorSmooth` false). */
export function cornerAnchors(set: AnchorSet): number[] {
  return anchorsWhere(set, (a) => !isAnchorSmooth(a));
}

/** Every smooth anchor (`isAnchorSmooth`). */
export function smoothAnchors(set: AnchorSet): number[] {
  return anchorsWhere(set, isAnchorSmooth);
}

/** Every anchor `selected` leaves out. */
export function invertAnchorSelection(set: AnchorSet, selected: Iterable<number>): number[] {
  const had = new Set(selected);
  return anchorsWhere(set, () => true).filter((k) => !had.has(k));
}
