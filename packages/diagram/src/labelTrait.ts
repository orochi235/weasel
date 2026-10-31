/**
 * The label trait: where along its edge a label sits. Data only — placing the
 * label on the route is `label`'s job, so layout can read one without
 * reaching the scene.
 */
import type { Vec2 } from '@weasel-js/core/math';

/** Where along an edge a label sits. */
export interface DiagramLabel {
  /** `'start'`, `'mid'` and `'end'` are 0, 0.5 and 1; a number is that
   *  fraction of the route's length. `{ near }` is the point on the route
   *  nearest `near`, in world coordinates — where `layered` leaves a label
   *  room — so a bend added or removed elsewhere leaves the label on the
   *  stretch it was on. */
  at: 'start' | 'mid' | 'end' | number | { near: Vec2 };
  /** World units between the route and the label's near side, to the **left
   *  of the direction of travel** — above a left-to-right edge. Default 0,
   *  which centers the label on the line. */
  offset?: number;
  /** For `'start'` and `'end'` only: world units between the route's end and
   *  the label's near side, along the route, so a label at an end clears the
   *  shape the route leaves or meets. Default 0, which centers it on the end. */
  inset?: number;
  /** Where label placement moved it, off a station something covered:
   *  `at` a fraction of the route's length, `offset` as above. Read in place
   *  of `at` and `offset`, which stay the author's preference. Written only
   *  by placement (`installLabelPlacement`). */
  placed?: LabelSpot;
  /** `false` keeps placement from ever moving this label. */
  dodge?: false;
}

/** A station placement chose: a fraction of the route's length, and the
 *  offset from the line. */
export interface LabelSpot {
  at: number;
  offset: number;
}

/** Where an edge label sits when neither the edge nor the scene says. */
export const LABEL_PLACEMENT: DiagramLabel = { at: 'mid', offset: 9 };

/** The label trait on a node's data, or `null`. */
export function diagramLabelOf(node: { data: unknown }): DiagramLabel | null {
  const data = node.data;
  if (data === null || typeof data !== 'object') return null;
  const trait = (data as { diagram?: unknown }).diagram;
  if (trait === null || typeof trait !== 'object') return null;
  const label = (trait as { label?: unknown }).label;
  if (label === null || typeof label !== 'object') return null;
  return 'at' in label ? (label as DiagramLabel) : null;
}
