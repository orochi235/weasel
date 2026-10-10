import { useLayoutEffect, useState, type RefObject } from 'react';
import type { PrefDrop, PrefDropMark } from './drop';
import { PATH_ATTR } from './selection';

const FORM_ATTR = 'data-pref-form';
const DROPPING_ATTR = 'data-dropping';
const SCROLL_ATTR = 'data-pref-scroll';

/** How far outside a row a point still counts as beside it: the gaps between rows belong to the nearest one. */
const ROW_SNAP = 16;
const RAIL_SNAP = 6;
/** The share of a rail entry, from each end, that drops beside it; the middle drops into it. */
const RAIL_EDGE = 0.3;

interface Rect { left: number; top: number; right: number; bottom: number }

interface Scroller { el: Element; rect: Rect; left: number; top: number }

interface Box {
  kind: 'rail' | 'row' | 'group';
  path: string;
  rect: Rect;
  /** Index of the scroller the box moves with, or -1. */
  scroller: number;
  /** Index of the group box whose rows this row is among, or -1. */
  owner: number;
  /** Split across: the row shares its line with another. */
  across: boolean;
}

/** A form's layout as measured while it drew no drop. */
interface Frame { left: number; top: number; scrollers: Scroller[]; boxes: Box[] }

const frames = new WeakMap<Element, Frame>();

/** The attributes of a form's root element, which `prefDropTargetAt` finds the form by. */
export function formAttrs(drop: PrefDrop | null): Record<string, string | undefined> {
  return { [FORM_ATTR]: '', [DROPPING_ATTR]: drop ? '' : undefined };
}

const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
};

function measure(form: Element): Frame {
  const origin = form.getBoundingClientRect();
  const scrollers: Scroller[] = [];
  const scrollerOf = (el: Element): number => {
    const s = el.parentElement?.closest(`[${SCROLL_ATTR}]`);
    if (!s || !form.contains(s)) return -1;
    const at = scrollers.findIndex((x) => x.el === s);
    if (at >= 0) return at;
    scrollers.push({ el: s, rect: rectOf(s), left: s.scrollLeft, top: s.scrollTop });
    return scrollers.length - 1;
  };
  const twoAcross = form.getAttribute('data-across') === '2';
  const els = [...form.querySelectorAll(`[data-pref-rail], [${PATH_ATTR}], [data-pref-into]`)];
  const index = new Map(els.map((el, i) => [el, i]));
  const boxes = els.map((el): Box => {
    const rail = el.getAttribute('data-pref-rail');
    const leaf = el.hasAttribute('data-pref-leaf');
    const owner = leaf ? el.parentElement?.closest(`[${PATH_ATTR}]:not([data-pref-leaf]), [data-pref-into]`) : null;
    return {
      kind: rail !== null ? 'rail' : leaf ? 'row' : 'group',
      path: rail ?? el.getAttribute(PATH_ATTR) ?? el.getAttribute('data-pref-into')!,
      rect: rectOf(el),
      scroller: scrollerOf(el),
      owner: owner ? index.get(owner) ?? -1 : -1,
      across: twoAcross && !el.hasAttribute('data-wide'),
    };
  });
  return { left: origin.left, top: origin.top, scrollers, boxes };
}

const inside = (r: Rect, x: number, y: number): boolean => x >= r.left && x < r.right && y >= r.top && y < r.bottom;

const distance = (r: Rect, x: number, y: number): number =>
  Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));

function hit(frame: Frame, form: Element, clientX: number, clientY: number): PrefDropMark | null {
  const now = form.getBoundingClientRect();
  const x = clientX - (now.left - frame.left);
  const y = clientY - (now.top - frame.top);
  /** The point in the coordinates `box` was measured in, or null where its scroller does not show it. */
  const pointIn = (box: Box): { x: number; y: number } | null => {
    const s = frame.scrollers[box.scroller];
    if (!s) return { x, y };
    if (!inside(s.rect, x, y)) return null;
    return { x: x + s.el.scrollLeft - s.left, y: y + s.el.scrollTop - s.top };
  };
  const nearest = (among: (box: Box) => boolean, within: number): number => {
    let best = -1;
    let bestD = within;
    frame.boxes.forEach((box, i) => {
      const p = among(box) ? pointIn(box) : null;
      const d = p ? distance(box.rect, p.x, p.y) : Infinity;
      if (d < bestD) { best = i; bestD = d; }
    });
    return best;
  };

  // The last box in document order holding the point is the deepest one.
  let found = -1;
  frame.boxes.forEach((box, i) => {
    const p = pointIn(box);
    if (p && inside(box.rect, p.x, p.y)) found = i;
  });
  if (found < 0) found = nearest((b) => b.kind === 'rail', RAIL_SNAP);
  if (found < 0) return null;
  let box = frame.boxes[found]!;
  if (box.kind === 'group') {
    const row = nearest((b) => b.kind === 'row' && b.owner === found, ROW_SNAP);
    if (row < 0) return { path: box.path, where: 'into' };
    box = frame.boxes[row]!;
  }
  const p = pointIn(box)!;
  const { rect } = box;
  if (box.kind === 'rail') {
    const t = (p.y - rect.top) / (rect.bottom - rect.top);
    const where = box.path === '' || (t >= RAIL_EDGE && t <= 1 - RAIL_EDGE) ? 'into' : t < RAIL_EDGE ? 'before' : 'after';
    return { path: box.path, where, rail: true };
  }
  const before = box.across ? p.x < (rect.left + rect.right) / 2 : p.y < (rect.top + rect.bottom) / 2;
  return { path: box.path, where: before ? 'before' : 'after' };
}

/**
 * Where a drop at a client point inside `root` would land in the form there: before or after the leaf under it,
 * by the half of its row the point is in, across for rows set side by side; into the group under it; or, on a
 * rail entry, beside it from either end and into it from the middle. Null over none of those.
 *
 * A form drawing a `drop` is read as it lay before it drew one, so the answer never depends on the reflow the
 * last answer caused, and a pointer held still gets the same answer every time.
 */
export function prefDropTargetAt(root: Element, x: number, y: number): PrefDropMark | null {
  const el = root.ownerDocument.elementFromPoint?.(x, y);
  if (!el || !root.contains(el)) return null;
  const form = el.closest(`[${FORM_ATTR}]`);
  if (!form) return null;
  let frame = frames.get(form);
  if (!frame || !form.hasAttribute(DROPPING_ATTR)) {
    frame = measure(form);
    frames.set(form, frame);
  }
  return hit(frame, form, x, y);
}

/**
 * The drop a form draws this render: `drop`, or none for the one render after `root` or `page` changed under a
 * drag, in which the form is measured afresh for `prefDropTargetAt` before it draws the drop again.
 */
export function useDropFrame(
  form: RefObject<Element | null>, drop: PrefDrop | null | undefined, root: unknown, page: string,
): PrefDrop | null {
  const [settled, setSettled] = useState({ root, page });
  const same = settled.root === root && settled.page === page;
  useLayoutEffect(() => {
    if (same || !drop) return;
    if (form.current) frames.set(form.current, measure(form.current));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the layout is measured without the drop, then drawn with it
    setSettled({ root, page });
  }, [same, drop, form, root, page]);
  return drop && same ? drop : null;
}
