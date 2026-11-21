import { createContext, useContext, useLayoutEffect } from 'react';
import type { EdgeCap } from '../Badge/bases/edgeProfiles';
import type { BadgeSize, BadgeVariant } from '../Badge/types';

/** What a {@link Powerline} row tells every segment in it. */
export interface PowerlineRow {
  /** The cap each segment reported for its right edge, by position. */
  caps: readonly (EdgeCap | undefined)[];
  startCap: EdgeCap;
  depth?: number;
  variant?: BadgeVariant;
  size?: BadgeSize;
  segmentClassName: string;
  /** Records a segment's right-edge cap at `index`, or withdraws it with `undefined`. */
  report: (index: number, cap: EdgeCap | undefined) => void;
}

/** One child's place in a {@link Powerline}. */
export interface PowerlineSlot {
  index: number;
  row: PowerlineRow;
}

export const PowerlineSlotContext = createContext<PowerlineSlot | null>(null);

/** How a segment draws inside a {@link Powerline}: its two edge caps, and the row's defaults. */
export interface PowerlineSegmentShape {
  leftEdge: EdgeCap;
  rightEdge: EdgeCap;
  depth?: number;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className: string;
}

/**
 * Reads this child's place in the nearest {@link Powerline} and reports its own
 * right-edge cap there, so the next child can take it as its left edge. Null
 * outside a powerline. A `Badge` calls it; a custom segment can too.
 */
export function usePowerlineSegment(endCap: EdgeCap = 'flat'): PowerlineSegmentShape | null {
  const slot = useContext(PowerlineSlotContext);
  const index = slot?.index;
  const report = slot?.row.report;
  useLayoutEffect(() => {
    if (report === undefined || index === undefined) return;
    report(index, endCap);
    return () => report(index, undefined);
  }, [report, index, endCap]);
  if (!slot) return null;
  const { row } = slot;
  return {
    leftEdge: slot.index === 0 ? row.startCap : (row.caps[slot.index - 1] ?? 'flat'),
    rightEdge: endCap,
    depth: row.depth,
    variant: row.variant,
    size: row.size,
    className: row.segmentClassName,
  };
}
