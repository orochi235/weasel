import { createContext } from 'react';
import type { Point, TrackRun } from '@weasel-js/geom';

/** The side of its button a bar's popover or menu opens on. */
export type BarSide = 'top' | 'bottom' | 'left' | 'right';

/** The compass side nearest `outward`; a tie between axes goes to top/bottom. */
export function sideOf(outward: Point): BarSide {
  if (Math.abs(outward.y) >= Math.abs(outward.x)) return outward.y < 0 ? 'top' : 'bottom';
  return outward.x < 0 ? 'left' : 'right';
}

/** The side a curved bar's item opens its popovers and menus on; undefined on a straight bar, which opens them as it always has. */
export const BarSideContext = createContext<BarSide | undefined>(undefined);

/** The side a popover opens on from the item at fraction `g` of `run`: the shape's outward normal, which on a flipped run is the item's up reversed. */
export function sideAtRun(run: TrackRun, g: number): BarSide {
  const { normal } = run.at(g);
  return sideOf(run.flipped ? { x: -normal.x, y: -normal.y } : normal);
}
