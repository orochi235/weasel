import { useLayoutEffect, useState, type RefObject } from 'react';
import type { PrefDrop, PrefDropMark } from './drop';
import { slidesIn } from './dropMotion';
import { PATH_ATTR, RAIL_ATTR } from './selection';

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
  /** Index of the cover whose title can sit over the box, or -1. */
  cover: number;
}

/** A section whose title sticks to the top of its scroller, over the section's own rows: its rect, and the title's height. */
interface Cover { rect: Rect; height: number }

/** A form's layout as measured while it drew no drop. */
interface Frame { left: number; top: number; scrollers: Scroller[]; covers: Cover[]; boxes: Box[] }

const frames = new WeakMap<Element, Frame>();

/** The attributes of a form's root element, which `prefDropTargetAt` finds the form by. */
export function formAttrs(drop: PrefDrop | null): Record<string, string | undefined> {
  // A drop with nowhere to land moves nothing, so the form is still read as it lies.
  return { [FORM_ATTR]: '', [DROPPING_ATTR]: drop && drop.where !== 'home' ? '' : undefined };
}

function measure(form: Element): Frame {
  const slide = slidesIn(form);
  /** Where `el` lies, whatever slide it is drawn part-way through. */
  const rectOf = (el: Element): Rect => {
    const r = el.getBoundingClientRect();
    const { x, y } = slide(el);
    return { left: r.left - x, top: r.top - y, right: r.right - x, bottom: r.bottom - y };
  };
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
  const sections = [...form.querySelectorAll('[data-pref-sticky]')].map((title) => ({ title, el: title.parentElement! }));
  const els = [...form.querySelectorAll(`[${RAIL_ATTR}], [${PATH_ATTR}], [data-pref-into]`)];
  const index = new Map(els.map((el, i) => [el, i]));
  const boxes = els.map((el): Box => {
    const rail = el.getAttribute(RAIL_ATTR);
    const leaf = el.hasAttribute('data-pref-leaf');
    const owner = leaf ? el.parentElement?.closest(`[${PATH_ATTR}]:not([data-pref-leaf]), [data-pref-into]`) : null;
    return {
      kind: rail !== null ? 'rail' : leaf ? 'row' : 'group',
      path: rail ?? el.getAttribute(PATH_ATTR) ?? el.getAttribute('data-pref-into')!,
      rect: rectOf(el),
      scroller: scrollerOf(el),
      owner: owner ? index.get(owner) ?? -1 : -1,
      across: twoAcross && !el.hasAttribute('data-wide'),
      cover: sections.findIndex((s) => s.el !== el && s.el.contains(el)),
    };
  });
  const covers = sections.map((s) => ({ rect: rectOf(s.el), height: s.title.getBoundingClientRect().height }));
  return { left: origin.left, top: origin.top, scrollers, covers, boxes };
}

const inside = (r: Rect, x: number, y: number): boolean => x >= r.left && x < r.right && y >= r.top && y < r.bottom;

const distance = (r: Rect, x: number, y: number): number =>
  Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));

function hit(frame: Frame, form: Element, clientX: number, clientY: number, railInto: boolean): PrefDropMark | null {
  const now = form.getBoundingClientRect();
  const x = clientX - (now.left - frame.left);
  const y = clientY - (now.top - frame.top);
  /** The point in the coordinates `box` was measured in, or null where its scroller, or a title stuck over it, does not show it. */
  const pointIn = (box: Box): { x: number; y: number } | null => {
    const s = frame.scrollers[box.scroller];
    if (!s) return { x, y };
    if (!inside(s.rect, x, y)) return null;
    const p = { x: x + s.el.scrollLeft - s.left, y: y + s.el.scrollTop - s.top };
    const c = frame.covers[box.cover];
    if (c) {
      // The title holds to the scroller's top edge from when its section reaches it until the section's end.
      const top = Math.min(s.rect.top + s.el.scrollTop - s.top, c.rect.bottom - c.height);
      if (top > c.rect.top && p.y >= top && p.y < top + c.height) return null;
    }
    return p;
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
    const edge = railInto ? RAIL_EDGE : 0.5;
    // The root's entry has nothing beside it: what it holds is the root's own.
    const where = box.path === '' || (t >= edge && t <= 1 - edge && railInto) ? 'into' : t < edge ? 'before' : 'after';
    return { path: box.path, where, rail: true };
  }
  const before = box.across ? p.x < (rect.left + rect.right) / 2 : p.y < (rect.top + rect.bottom) / 2;
  return { path: box.path, where: before ? 'before' : 'after' };
}

/** How {@link prefDropTargetAt} reads a point. */
export interface PrefDropTargetOptions {
  /** Whether a rail entry's middle drops into its group. Off for a drag of what belongs among the entries. Default true. */
  railInto?: boolean;
}

/**
 * Where a drop at a client point inside `root` would land in the form there: before or after the leaf under it,
 * by the half of its row the point is in, across for rows set side by side; into the group under it; or, on a
 * rail entry, beside it from either end and into it from the middle, or with `railInto` off, beside it from
 * either half. Null over none of those.
 *
 * A form drawing a `drop` is read as it lay before it drew one, so the answer never depends on the reflow the
 * last answer caused, and a pointer held still gets the same answer every time.
 */
export function prefDropTargetAt(root: Element, x: number, y: number, { railInto = true }: PrefDropTargetOptions = {}): PrefDropMark | null {
  const el = root.ownerDocument.elementFromPoint?.(x, y);
  if (!el || !root.contains(el)) return null;
  const form = el.closest(`[${FORM_ATTR}]`);
  if (!form) return null;
  let frame = frames.get(form);
  if (!frame || !form.hasAttribute(DROPPING_ATTR)) {
    frame = measure(form);
    frames.set(form, frame);
  }
  return hit(frame, form, x, y, railInto);
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
