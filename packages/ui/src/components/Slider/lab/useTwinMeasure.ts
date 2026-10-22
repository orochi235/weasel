import { useLayoutEffect, useState, type RefObject } from 'react';
import type { TrackShape } from '@weasel-js/geom';

/** One thumb as the page shows it. */
export interface ThumbReading {
  value: string;
  spoken: string;
  /** Degrees the thumb is turned, from its computed transform. */
  angle: number;
  /** Px from the thumb's center to the shape; null on a straight slider. */
  off: number | null;
}

/** What a twin shows: its thumbs, and how many readouts and stop labels it draws. */
export interface TwinReading {
  thumbs: ThumbReading[];
  readouts: number;
  labels: number;
}

const EMPTY: TwinReading = { thumbs: [], readouts: 0, labels: 0 };

function angleOf(el: Element): number {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return 0;
  const m = new DOMMatrix(t);
  const deg = (Math.atan2(m.b, m.a) * 180) / Math.PI;
  return deg === 0 ? 0 : deg;
}

function read(root: HTMLElement, shape: TrackShape | null): TwinReading {
  const box = root.getBoundingClientRect();
  const thumbs = [...root.querySelectorAll<HTMLElement>('[role="slider"]')].map((el) => {
    const r = el.getBoundingClientRect();
    const p = { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
    return {
      value: el.getAttribute('aria-valuenow') ?? '',
      spoken: el.getAttribute('aria-valuetext') ?? '',
      angle: angleOf(el),
      off: shape ? shape.nearest(p).dist : null,
    };
  });
  return { thumbs, readouts: root.querySelectorAll('[data-readout]').length, labels: root.querySelectorAll('[data-slider-stop-label]').length };
}

/**
 * What the slider inside `root` shows, read from the page after every render: each thumb's value and spoken text
 * as it publishes them, how far it is turned, and on a curve how far it sits off `shape`, which is in `root`'s px.
 */
export function useTwinMeasure(root: RefObject<HTMLElement | null>, shape: TrackShape | null): TwinReading {
  const [reading, setReading] = useState<TwinReading>(EMPTY);
  // Read after every render, and again whenever the slider lays itself out on its own, which renders nothing here.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const update = (): void => {
      const next = read(el, shape);
      setReading((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    update();
    const mo = new MutationObserver(update);
    mo.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'aria-valuenow', 'aria-valuetext'] });
    return () => mo.disconnect();
  });
  return reading;
}
