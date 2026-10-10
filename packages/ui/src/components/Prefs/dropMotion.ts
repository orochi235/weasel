import { useLayoutEffect, useRef, type RefObject } from 'react';
import { prefersReducedMotion } from '../../reducedMotion';
import type { PrefDrop } from './drop';
import { PATH_ATTR } from './selection';

const REFLOW = 'pref-drop-reflow';
const MOVED = `[${PATH_ATTR}], [data-pref-rail], [data-drop-placeholder]`;

interface Offset { x: number; y: number }
const ZERO: Offset = { x: 0, y: 0 };

/** Where everything a form drew lay at its last render, and what that render drew. */
interface Seen { root: unknown; page: string; width: number; height: number; spots: Map<string, Offset> }

const slidesOf = (form: Element): Map<Element, Animation> =>
  // Optional-called: jsdom's elements have no `getAnimations`.
  new Map((form.getAnimations?.({ subtree: true }) ?? []).filter((a) => a.id === REFLOW)
    .map((a) => [(a.effect as KeyframeEffect).target!, a]));

const ownSlide = (el: Element): Offset => {
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
  return { x: m.m41, y: m.m42 };
};

/**
 * How far from where it lies each element of a form is drawn right now, part-way through a slide of its own or
 * of something it is inside.
 */
export function slidesIn(form: Element): (el: Element) => Offset {
  const sliding = new Map([...slidesOf(form).keys()].map((el) => [el, ownSlide(el)]));
  if (sliding.size === 0) return () => ZERO;
  return (el) => {
    let x = 0;
    let y = 0;
    for (let at: Element | null = el; at && at !== form; at = at.parentElement) {
      const own = sliding.get(at);
      if (own) { x += own.x; y += own.y; }
    }
    return { x, y };
  };
}

const milliseconds = (time: string): number => parseFloat(time) * (time.trim().endsWith('ms') ? 1 : 1000);

/**
 * Slides what a form draws from where it lay to where a change of `drop` puts it. A row, a group, and a rail
 * entry are each followed by path, and a placeholder by the path its node was dragged from, so a row picked up
 * slides to where it would land. Nothing slides when `root` or `page` changes: that is another form.
 */
export function useDropMotion(form: RefObject<Element | null>, on: boolean, drop: PrefDrop | null, root: unknown, page: string): void {
  const seen = useRef<Seen | null>(null);
  // Every render: a row can move for reasons the form is not told of, and the next slide starts from where it lay.
  useLayoutEffect(() => {
    const el = form.current;
    if (!on || !el || typeof el.animate !== 'function') return;
    const running = slidesOf(el);
    const slide = slidesIn(el);
    const origins = new Map<Element, Offset>();
    const originOf = (box: Element): Offset => {
      let o = origins.get(box);
      if (!o) {
        const r = box.getBoundingClientRect();
        o = { x: r.left - box.scrollLeft, y: r.top - box.scrollTop };
        origins.set(box, o);
      }
      return o;
    };
    const was = seen.current;
    const fresh = !was || was.root !== root || was.page !== page || was.width !== el.clientWidth || was.height !== el.clientHeight
      || prefersReducedMotion();
    const counts = new Map<string, number>();
    const spots = new Map<string, Offset>();
    /** How far each element's place moved since the last render. */
    const moved = new Map<Element, Offset>();
    const slides: Array<[Element, Offset]> = [];
    // In document order, so what an element is inside is read before it.
    for (const e of el.querySelectorAll(MOVED)) {
      const above = e.parentElement!.closest(MOVED);
      const carried = (above && moved.get(above)) || ZERO;
      const key = keyOf(e, drop, counts);
      const scroller = e.parentElement!.closest('[data-pref-scroll]');
      const origin = originOf(scroller && el.contains(scroller) ? scroller : el);
      const r = e.getBoundingClientRect();
      const under = slide(e);
      const spot = { x: r.left - origin.x - under.x, y: r.top - origin.y - under.y };
      if (key !== null) spots.set(key, spot);
      const prev = key === null || fresh ? undefined : was.spots.get(key);
      const shift = prev ? { x: prev.x - spot.x, y: prev.y - spot.y } : carried;
      moved.set(e, shift);
      // What the slide of the thing it is inside does not already carry it through.
      const local = { x: shift.x - carried.x, y: shift.y - carried.y };
      if (Math.abs(local.x) > 0.5 || Math.abs(local.y) > 0.5) {
        const own = running.has(e) ? ownSlide(e) : ZERO;
        slides.push([e, { x: local.x + own.x, y: local.y + own.y }]);
      }
    }
    seen.current = { root, page, width: el.clientWidth, height: el.clientHeight, spots };
    if (fresh) {
      for (const a of running.values()) a.cancel();
      return;
    }
    if (slides.length === 0) return;
    const style = getComputedStyle(el);
    const duration = milliseconds(style.getPropertyValue('--wzl-motion-fast')) || 120;
    const easing = style.getPropertyValue('--wzl-ease-out-cubic').trim() || 'ease-out';
    for (const [e, from] of slides) {
      running.get(e)?.cancel();
      e.animate([{ transform: `translate(${from.x}px, ${from.y}px)` }, { transform: 'none' }], { duration, easing, id: REFLOW });
    }
  });
}

/** What follows an element from one render to the next, or null for one that is not followed. */
function keyOf(el: Element, drop: PrefDrop | null, counts: Map<string, number>): string | null {
  const slot = el.getAttribute('data-drop-placeholder');
  const rail = el.getAttribute('data-pref-rail');
  // Inside a placeholder, and carried by it.
  if (slot === '') return null;
  const path = slot !== null ? drop?.from?.[Number(slot)] ?? `\u0000${slot}` : rail ?? el.getAttribute(PATH_ATTR);
  const key = `${rail !== null || el.hasAttribute('data-drop-rail') ? 'rail' : 'row'}:${path}`;
  // A tab and its panel are drawn for one path.
  const n = counts.get(key) ?? 0;
  counts.set(key, n + 1);
  return `${key}#${n}`;
}
