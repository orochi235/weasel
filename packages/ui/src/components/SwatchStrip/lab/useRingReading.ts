import { useLayoutEffect, useState, type RefObject } from 'react';
import type { Point } from '@weasel-js/geom';

/** One ring as the page draws it, read off the swatches' boxes. */
export interface RingReading {
  /** Which palette the ring belongs to, by its group's name, and its place among the strip's rings. */
  group: string;
  ring: number;
  swatches: number;
  /** Mean distance of the swatches' centers from the arc's center, and how far the nearest and farthest differ. */
  radius: number;
  radiusSpread: number;
  /** Mean distance along the ring between two neighbors' centers, and how far the closest and widest pair differ. */
  spacing: number;
  spacingSpread: number;
  /** Distance of the ring's lead from the arc's center, when it has one. */
  lead: number | undefined;
}

const centerOf = (el: Element, origin: DOMRect): Point => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2 - origin.left, y: r.top + r.height / 2 - origin.top };
};

const spread = (xs: readonly number[]): number => (xs.length ? Math.max(...xs) - Math.min(...xs) : 0);
const mean = (xs: readonly number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Every ring under `root`, read again whenever anything under it moves. Swatches scrolled off a ring are left out. */
export function readRings(root: HTMLElement, center: Point): RingReading[] {
  const origin = root.getBoundingClientRect();
  const out: RingReading[] = [];
  let ring = 0;
  for (const group of root.querySelectorAll<HTMLElement>('[role="group"][aria-label]:has(> [data-ring])')) {
    for (const row of group.querySelectorAll<HTMLElement>('[data-ring]')) {
      const shown = [...row.querySelectorAll<HTMLElement>('[data-swatch]')].filter((el) => !el.hasAttribute('data-clipped') || el.getAttribute('data-clipped') === 'none');
      const points = shown.map((el) => centerOf(el, origin));
      const radii = points.map((p) => Math.hypot(p.x - center.x, p.y - center.y));
      const r = mean(radii);
      const gaps = points.slice(1).map((p, i) => {
        const chord = Math.hypot(p.x - points[i]!.x, p.y - points[i]!.y);
        return 2 * r * Math.asin(Math.min(1, chord / (2 * r)));
      });
      const lead = row.querySelector('[data-ring-item="lead"]');
      const l = lead ? centerOf(lead, origin) : undefined;
      out.push({
        group: group.getAttribute('aria-label')!,
        ring: ring++,
        swatches: shown.length,
        radius: r,
        radiusSpread: spread(radii),
        spacing: mean(gaps),
        spacingSpread: spread(gaps),
        lead: l && Math.hypot(l.x - center.x, l.y - center.y),
      });
    }
  }
  return out;
}

/** {@link readRings} for `root`, kept current as the rings lay themselves out and scroll. */
export function useRingReading(root: RefObject<HTMLElement | null>, center: Point): RingReading[] {
  const [rings, setRings] = useState<RingReading[]>([]);
  const { x, y } = center;
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const read = () => setRings(readRings(el, { x, y }));
    read();
    const watch = new MutationObserver(read);
    watch.observe(el, { subtree: true, attributes: true, attributeFilter: ['style', 'data-clipped'], childList: true });
    return () => watch.disconnect();
  }, [root, x, y]);
  return rings;
}
