import { createContext, useContext, useLayoutEffect } from 'react';
import type { EdgeCap } from '../Badge/bases/edgeProfiles';
import type { BadgeSize, BadgeVariant } from '../Badge/types';

/** What a {@link Powerline} row tells every segment in it. */
export interface PowerlineRow {
  /** The cap each segment reported for its right edge, by position. */
  caps: readonly EdgeCap[];
  startCap: EdgeCap;
  depth?: number;
  variant?: BadgeVariant;
  size?: BadgeSize;
  segmentClassName: string;
  report: (index: number, cap: EdgeCap) => void;
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
  useLayoutEffect(() => { slot?.row.report(slot.index, endCap); }, [slot, endCap]);
  if (!slot) return null;
  const { index, row } = slot;
  return {
    leftEdge: index === 0 ? row.startCap : (row.caps[index - 1] ?? 'flat'),
    rightEdge: endCap,
    depth: row.depth,
    variant: row.variant,
    size: row.size,
    className: row.segmentClassName,
  };
}
