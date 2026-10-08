import {
  useLayoutEffect,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react';
import { qty, type Display } from '@weasel-js/quantity';
import s from './BandEditor.module.css';
import type { RangeEdge } from './bands';
import { pct } from './track';

/** Clear space, in px, a tick label must keep from an end label to stay shown. */
const END_GAP_PX = 4;

export interface RulerProps {
  trackRef: RefObject<HTMLDivElement | null>;
  ticks?: { at: number; label?: ReactNode }[];
  /** Labels a tick that has no `label` of its own; without it such a tick is unlabeled. */
  display?: Display;
  /** The range's ends, labeled, when they can be dragged. A tick that would collide with one is hidden. */
  ends?: { edge: RangeEdge; at: number; label: ReactNode }[];
  toUnit: (value: number) => number;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
}

function extent(el: Element): { left: number; right: number } {
  let { left, right } = el.getBoundingClientRect();
  for (const child of el.children) {
    const box = child.getBoundingClientRect();
    left = Math.min(left, box.left);
    right = Math.max(right, box.right);
  }
  return { left, right };
}

/** Marks every tick whose mark or label comes within `END_GAP_PX` of an end's. */
function occludeTicks(root: HTMLElement): void {
  const ends = [...root.querySelectorAll('[data-range-end]')].map(extent);
  for (const tick of root.querySelectorAll<HTMLElement>('[data-tick-at]')) {
    const box = extent(tick);
    const hit = ends.some((end) => box.left < end.right + END_GAP_PX && end.left < box.right + END_GAP_PX);
    tick.toggleAttribute('data-occluded', hit);
  }
}

/** `BandEditor`'s tick strip. Its box is the track every pointer position is measured against. */
export function Ruler({ trackRef, ticks, display, ends, toUnit, onPointerDown }: RulerProps): ReactElement {
  // Collision is a matter of rendered text width, so it is read from layout after every render rather than computed.
  useLayoutEffect(() => {
    if (trackRef.current) occludeTicks(trackRef.current);
  });
  useLayoutEffect(() => {
    const root = trackRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => occludeTicks(root));
    observer.observe(root);
    return () => observer.disconnect();
  }, [trackRef]);

  return (
    <div className={s.ruler} ref={trackRef} data-band-ruler="" onPointerDown={onPointerDown}>
      {ticks?.map((tick, i) => (
        <span
          key={i}
          className={s.tick}
          data-tick-at={tick.at}
          style={{ '--be-at': pct(toUnit(tick.at)) } as CSSProperties}
        >
          {(tick.label !== undefined || display !== undefined) && (
            <span className={s.tickLabel}>{tick.label ?? qty(tick.at, display).text}</span>
          )}
        </span>
      ))}
      {ends?.map((end) => (
        <span
          key={end.edge}
          className={[s.tick, s.endTick, end.edge === 'max' ? s.maxTick : null].filter(Boolean).join(' ')}
          data-range-end={end.edge}
          style={{ '--be-at': pct(toUnit(end.at)) } as CSSProperties}
        >
          <span className={[s.tickLabel, end.edge === 'min' ? s.startLabel : s.endLabel].join(' ')}>{end.label}</span>
        </span>
      ))}
    </div>
  );
}
