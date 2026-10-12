import type { ContainerBounds } from '@weasel-js/core';

/** One place a child's center goes. */
export interface Slot {
  x: number;
  y: number;
  /** The direction the slot faces, in radians, where the arrangement has one
   *  — outward from the center on a ring. `slotToPose` decides what to do
   *  with it; the default ignores it. */
  angle?: number;
}

/**
 * Where a container's slots are when it holds `count` children, in fill
 * order. Returning fewer than `count` caps the container: `slots` refuses
 * whatever would not fit.
 */
export type Arrangement = (bounds: ContainerBounds, count: number) => Slot[];

/** Options for `rowSlots`. */
export interface RowSlotsOptions {
  /** The axis the row runs along. Default `'x'`. */
  axis?: 'x' | 'y';
  /** Distance between neighboring slots, in world units, the row centered in
   *  the container. Absent, the slots divide the container's length evenly. */
  pitch?: number;
}

/** Slots in a line, centered across the container. */
export function rowSlots(opts: RowSlotsOptions = {}): Arrangement {
  const alongX = opts.axis !== 'y';
  return (bounds, count) => {
    const length = alongX ? bounds.width : bounds.height;
    const pitch = opts.pitch ?? length / Math.max(count, 1);
    const first = length / 2 - (pitch * (count - 1)) / 2;
    const out: Slot[] = [];
    for (let i = 0; i < count; i++) {
      const along = first + i * pitch;
      out.push(
        alongX
          ? { x: bounds.x + along, y: bounds.y + bounds.height / 2 }
          : { x: bounds.x + bounds.width / 2, y: bounds.y + along },
      );
    }
    return out;
  };
}

/** Options for `gridSlots`. */
export interface GridSlotsOptions {
  cols: number;
  /** Rows the grid has before any child needs one. Default 1. */
  rows?: number;
}

/** Slots at the centers of a grid that fills row by row, adding a row when the
 *  last fills; the rows always divide the container's height. */
export function gridSlots(opts: GridSlotsOptions): Arrangement {
  return (bounds, count) => {
    const rows = Math.max(opts.rows ?? 1, Math.ceil(count / opts.cols));
    const cw = bounds.width / opts.cols;
    const ch = bounds.height / rows;
    const out: Slot[] = [];
    for (let i = 0; i < count; i++) {
      out.push({
        x: bounds.x + ((i % opts.cols) + 0.5) * cw,
        y: bounds.y + (Math.floor(i / opts.cols) + 0.5) * ch,
      });
    }
    return out;
  };
}

/** Options for `ringSlots`. */
export interface RingSlotsOptions {
  /** Angle of the first slot, in radians, 0 pointing along +x and positive
   *  turning toward +y. Default −π/2: the top, on a y-down canvas. */
  start?: number;
  /** How far round the slots run. Default a full turn, which spaces them
   *  evenly; anything less puts a slot on each end of the arc. */
  sweep?: number;
  /** Distance to pull the ring in from the container's edges. Default 0. */
  inset?: number;
}

/** Slots around the ellipse inscribed in the container, each facing outward. */
export function ringSlots(opts: RingSlotsOptions = {}): Arrangement {
  const start = opts.start ?? -Math.PI / 2;
  const sweep = opts.sweep ?? Math.PI * 2;
  const inset = opts.inset ?? 0;
  const closed = Math.abs(sweep) >= Math.PI * 2;
  return (bounds, count) => {
    const rx = bounds.width / 2 - inset;
    const ry = bounds.height / 2 - inset;
    const steps = closed ? count : Math.max(count - 1, 1);
    const out: Slot[] = [];
    for (let i = 0; i < count; i++) {
      const angle = start + (sweep * i) / steps;
      out.push({
        x: bounds.x + bounds.width / 2 + rx * Math.cos(angle),
        y: bounds.y + bounds.height / 2 + ry * Math.sin(angle),
        angle,
      });
    }
    return out;
  };
}
