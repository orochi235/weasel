import { useLayoutEffect, useState, type RefObject } from 'react';
import type { PrefDrop, PrefDropMark } from './drop';
import { slidesIn } from './dropMotion';
import { PATH_ATTR, RAIL_ATTR } from './selection';

const FORM_ATTR = 'data-pref-form';
const DROPPING_ATTR = 'data-dropping';
const SCROLL_ATTR = 'data-pref-scroll';
const FRAGMENT_ATTR = 'data-pref-fragment';

/** How far outside a row a point still counts as beside it: the gaps between rows belong to the nearest one. */
const ROW_SNAP = 16;
const RAIL_SNAP = 6;
/** The share of a rail entry, from each end, that drops beside it; the middle drops into it. */
const RAIL_EDGE = 0.3;
/** How far into a fragment's first or last row, from its outer edge, a point drops beside the fragment and not beside the row. */
const FRAGMENT_EDGE = 6;

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
  /** Split across: the row shares its line with another, or is a cell of a bar that runs across. */
  across: boolean;
  /** Index of the cover whose title can sit over the box, or -1. */
  cover: number;
  /** Indices of the fragments the box lies in, the outermost first. */
  fragments: number[];
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

const GROUP = `[${PATH_ATTR}]:not([data-pref-leaf]), [data-pref-into]`;

/** The group a row's neighbors are measured in: the nearest with a box, a fragment's rows lying among its parent's. */
function ownerOf(row: Element): Element | null {
  let at = row.parentElement?.closest(GROUP) ?? null;
  while (at && getComputedStyle(at).display === 'contents') at = at.parentElement?.closest(GROUP) ?? null;
  return at;
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
  // Two across falls back to one column in a narrow form, so whether a row shares its line is the grid's to say.
  const sharesLine = (el: Element): boolean => {
    let grid = el.parentElement;
    while (grid && grid !== form && getComputedStyle(grid).display === 'contents') grid = grid.parentElement;
    return !!grid && getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length > 1;
  };
  const sections = [...form.querySelectorAll('[data-pref-sticky]')].map((title) => ({ title, el: title.parentElement! }));
  const els = [...form.querySelectorAll(`[${RAIL_ATTR}], [${PATH_ATTR}], [data-pref-into]`)];
  const index = new Map(els.map((el, i) => [el, i]));
  const boxes = els.map((el): Box => {
    const rail = el.getAttribute(RAIL_ATTR);
    const leaf = el.hasAttribute('data-pref-leaf');
    const owner = leaf ? ownerOf(el) : null;
    const bar = leaf ? el.closest('[data-pref-bar]') : null;
    return {
      kind: rail !== null ? 'rail' : leaf ? 'row' : 'group',
      path: rail ?? el.getAttribute(PATH_ATTR) ?? el.getAttribute('data-pref-into')!,
      rect: rectOf(el),
      scroller: scrollerOf(el),
      owner: owner ? index.get(owner) ?? -1 : -1,
      across: bar ? bar.getAttribute('data-orientation') !== 'vertical' : twoAcross && !el.hasAttribute('data-wide') && sharesLine(el),
      cover: sections.findIndex((s) => s.el !== el && s.el.contains(el)),
      fragments: [],
    };
  });
  // A fragment draws no box of its own, so it is measured as the rows inside it; an empty one has none to give it.
  els.forEach((el, i) => {
    if (!el.hasAttribute(FRAGMENT_ATTR)) return;
    const held = boxes.filter((box, j) => j > i && el.contains(els[j]!) && box.rect.bottom > box.rect.top);
    for (const box of held) box.fragments.push(i);
    if (held.length > 0) boxes[i]!.rect = unionOf(held.map((box) => box.rect));
  });
  const covers = sections.map((s) => ({ rect: rectOf(s.el), height: s.title.getBoundingClientRect().height }));
  return { left: origin.left, top: origin.top, scrollers, covers, boxes };
}

const unionOf = (rects: readonly Rect[]): Rect => ({
  left: Math.min(...rects.map((r) => r.left)),
  top: Math.min(...rects.map((r) => r.top)),
  right: Math.max(...rects.map((r) => r.right)),
  bottom: Math.max(...rects.map((r) => r.bottom)),
});

const inside = (r: Rect, x: number, y: number): boolean => x >= r.left && x < r.right && y >= r.top && y < r.bottom;

const distance = (r: Rect, x: number, y: number): number =>
  Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));

/**
 * Beside the outermost fragment the row at `row` starts or ends, where `p` is within {@link FRAGMENT_EDGE} of the
 * row's leading or trailing edge, or past it: its top and bottom, or its sides for a row set across.
 */
function besideFragment(frame: Frame, row: number, p: { x: number; y: number }): PrefDropMark | null {
  const { rect, across, fragments } = frame.boxes[row]!;
  const lead = across ? p.x - rect.left : p.y - rect.top;
  const trail = across ? rect.right - p.x : rect.bottom - p.y;
  for (const f of fragments) {
    const rows = frame.boxes.flatMap((b, i) => (b.kind === 'row' && b.fragments.includes(f) ? [i] : []));
    const { path } = frame.boxes[f]!;
    if (rows[0] === row && lead < FRAGMENT_EDGE) return { path, where: 'before' };
    if (rows.at(-1) === row && trail <= FRAGMENT_EDGE) return { path, where: 'after' };
  }
  return null;
}

function hit(frame: Frame, form: Element, clientX: number, clientY: number): PrefDropMark | null {
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
    const among = found;
    const row = nearest((b) => b.kind === 'row' && (b.owner === among || b.fragments.includes(among)), ROW_SNAP);
    if (row < 0) return { path: box.path, where: 'into' };
    found = row;
    box = frame.boxes[row]!;
  }
  const p = pointIn(box)!;
  const { rect } = box;
  const beside = box.kind === 'row' ? besideFragment(frame, found, p) : null;
  if (beside) return beside;
  if (box.kind === 'rail') {
    const t = (p.y - rect.top) / (rect.bottom - rect.top);
    // The root's entry has nothing beside it: what it holds is the root's own.
    const where = box.path === '' || (t >= RAIL_EDGE && t <= 1 - RAIL_EDGE) ? 'into' : t < RAIL_EDGE ? 'before' : 'after';
    return { path: box.path, where, rail: true };
  }
  const before = box.across ? p.x < (rect.left + rect.right) / 2 : p.y < (rect.top + rect.bottom) / 2;
  return { path: box.path, where: before ? 'before' : 'after' };
}

/**
 * Where a drop at a client point inside `root` would land in the form there: before or after the leaf under it,
 * by the half of its row the point is in, across for rows set side by side and for a bar's cells; into the group under it; or, on a
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
