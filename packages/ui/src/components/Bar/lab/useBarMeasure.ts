import { useLayoutEffect, useState, type RefObject } from 'react';
import type { Point, TrackShape } from '@weasel-js/geom';
import { cssPx } from '../../../cssPx';

export type Side = 'top' | 'bottom' | 'left' | 'right';

/** One thing on the bar as the page lays it out. */
export interface PlacedReading {
  kind: 'lead' | 'item' | 'more';
  name: string;
  /** Px along the run from its start to the item's center. */
  at: number;
  clipped: string;
  /** The compass side of the arc's outward normal at the item: where its popover should open. */
  side: Side;
}

/** What the bar shows: where each thing sits, whether it scrolls and by how much, and the last popover it opened. */
export interface BarReading {
  scrolls: boolean;
  offset: number;
  placed: PlacedReading[];
  popover: { trigger: string; placement: string; side: Side } | null;
}

const EMPTY: BarReading = { scrolls: false, offset: 0, placed: [], popover: null };

function sideOf(v: Point): Side {
  if (Math.abs(v.y) >= Math.abs(v.x)) return v.y < 0 ? 'top' : 'bottom';
  return v.x < 0 ? 'left' : 'right';
}

const nameOf = (el: Element): string =>
  el.querySelector('[aria-label]')?.getAttribute('aria-label') ?? el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '';

function read(root: HTMLElement, shape: TrackShape, reading: (p: Point) => number): BarReading {
  const bar = root.querySelector<HTMLElement>('[role="toolbar"]');
  if (!bar) return EMPTY;
  const box = root.getBoundingClientRect();
  const local = (el: Element): Point => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
  };
  const sideAt = (p: Point): Side => sideOf(shape.at(shape.nearest(p).f).normal);
  const els = [...bar.querySelectorAll<HTMLElement>(':scope > [data-bar-lead], :scope > [data-bar-item], :scope > [data-bar-more]')];
  const placed = els.map((el): PlacedReading => {
    const p = local(el);
    const kind = el.hasAttribute('data-bar-lead') ? 'lead' : el.hasAttribute('data-bar-more') ? 'more' : 'item';
    return { kind, name: kind === 'more' ? 'More' : nameOf(el), at: reading(p), clipped: el.getAttribute('data-clipped') ?? 'none', side: sideAt(p) };
  });
  const scrolls = bar.hasAttribute('data-scrolls');
  const offset = scrolls ? offsetOf(els, placed, cssPx(getComputedStyle(bar).columnGap)) : 0;
  const open = bar.querySelector<HTMLElement>('[aria-expanded="true"]');
  const pop = document.querySelector<HTMLElement>('[data-weasel-overlay][data-placement]');
  const popover = open && pop ? { trigger: nameOf(open.closest('[data-bar-item], [data-bar-more]') ?? open), placement: pop.getAttribute('data-placement')!, side: sideAt(local(open)) } : null;
  return { scrolls, offset, placed, popover };
}

/**
 * How far a scrolled run is laid back: where the first item wholly on the run would sit unscrolled, less where it
 * sits. An item past either end is drawn at that end, so it says nothing about the offset.
 */
function offsetOf(els: readonly HTMLElement[], placed: readonly PlacedReading[], gap: number): number {
  const k = placed.findIndex((p) => p.clipped === 'none');
  if (k < 0) return 0;
  const before = els.slice(0, k).reduce((sum, el) => sum + el.offsetWidth + gap, 0);
  return before + els[k]!.offsetWidth / 2 - placed[k]!.at;
}

/**
 * What the curved bar inside `root` shows, read off the page whenever the bar or the document's overlays change.
 * `shape` is in `root`'s px; `reading` says how far along the run, in px, a point in those px lies.
 */
export function useBarMeasure(root: RefObject<HTMLElement | null>, shape: TrackShape, reading: (p: Point) => number): BarReading {
  const [state, setState] = useState<BarReading>(EMPTY);
  // Read after every render, and again when the bar lays itself out after measuring its items or a popover opens
  // in a portal outside it, neither of which renders anything here.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const update = (): void => {
      const next = read(el, shape, reading);
      setState((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    update();
    const mo = new MutationObserver(update);
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'data-clipped', 'data-placement', 'aria-expanded', 'data-scrolls'] });
    return () => mo.disconnect();
  });
  return state;
}
