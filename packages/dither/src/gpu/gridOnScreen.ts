import type { OutputGrid, View } from '@weasel-js/geom';

/** A dot grid in device pixels of the drawing buffer, from its top left. */
export interface DeviceGrid {
  pitch: readonly [number, number];
  origin: readonly [number, number];
}

/** `grid` where `view` at `dpr` puts it. In a layer group's effect thunk,
 *  `dpr` is `dims.dpr`; in a node's draw, `ctx.pixelScale / view.scale.x`.
 *  A flipped axis gives a negative pitch, which keeps dots numbered in
 *  document order: dot 0 still sits at the grid's document origin. */
export function gridOnScreen(grid: OutputGrid, view: View, dpr: number): DeviceGrid {
  const sx = view.scale.x * dpr;
  const sy = view.scale.y * dpr;
  return {
    pitch: [grid.pitch * sx, grid.pitch * sy],
    origin: [(grid.origin.x - view.x) * sx, (grid.origin.y - view.y) * sy],
  };
}
