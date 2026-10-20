import type { Vec2 } from '@weasel-js/core/math';
import type { GroupInset } from './cluster';
import type { Outline } from './outline';
import type { DiagramContainer } from './containers/trait';
import type { FontField, StyleField } from './theme/styleField';

/**
 * Where a port sits on its node, in **normalized bounds coordinates**:
 * `(0, 0)` is the top-left corner of the node's AABB and `(1, 1)` the
 * bottom-right. `COMPASS` names the eight positions almost everything wants.
 *
 * Normalized rather than absolute because a node's size is authored data that
 * resize, align and distribute all write — a port fixed at an offset would
 * drift off the shape the first time one of them ran.
 */
export interface PortAnchor {
  u: number;
  v: number;
}

/** One more place a port may sit, and optionally the direction it faces there. */
export interface PortSite extends PortAnchor {
  normal?: Vec2 | null;
}

/** One attachment point declared on a node. */
export interface PortSpec {
  /** Unique within the node. Edges name this, so it outlives a re-layout. */
  id: string;
  at: PortAnchor;
  /** Other places the port may sit. An edge meeting the port takes whichever
   *  of `at` and these faces the edge's next point most directly, so a
   *  diamond's second exit can leave by its top or its bottom vertex, toward
   *  wherever its wire goes. Everything else that shows a port where it is —
   *  the connect affordance, `portsOf` — reads `at`. A site faces away from
   *  the node's center unless it gives a `normal` of its own. */
  sites?: readonly PortSite[];
  /** Consulted by a connect gesture's validity predicate. Uninterpreted here. */
  type?: string;
  /** What the port is for, drawn beside it outside the node: beside the
   *  wire rather than across it. A built body draws it and keeps it in its
   *  `margin`; any other participant gets it on its resolved `Port`. */
  label?: string;
  /** The direction an edge leaves along, overriding the one the anchor
   *  implies. `null` means "no preferred direction" — a router goes straight
   *  at it. Applies at `at`; each of `sites` says its own. */
  normal?: Vec2 | null;
}

/**
 * The trait that makes an existing scene node a diagram participant.
 *
 * Attached to a node's `data`, not a node kind the plugin mints: a text block,
 * an image, a path, a group or a plain rect all take part by carrying this,
 * and nothing has to be authored through this package to be connectable.
 */
export interface DiagramNode {
  /** Defaults to {@link DEFAULT_PORTS} — the four edge midpoints of the
   *  node's own bounds, which every node has. */
  ports?: readonly PortSpec[];
  /** Layout must not move this node. */
  pinned?: boolean;
  /** What the node is *drawn* as. Present on a built body; absent on a
   *  participant that already had a look of its own — a text block, an image,
   *  a path — which keeps whatever painter it already matched. */
  outline?: Outline;
  /** Present on a group's box: a node drawn around the participants it
   *  depends on, which layout keeps together and leaves room for. The box
   *  itself is never laid out — it derives its pose from its members — but an
   *  edge can attach to it like any participant. */
  group?: DiagramGroup;
  /** Present on a container, a pool, or a lane: a `ContainerNode` holding
   *  members (`containers/trait.ts`). */
  container?: DiagramContainer;
  /** How far past its bounds something drawn with it reaches, on each side —
   *  a built body's port labels. Layout keeps neighbors that far off too. */
  margin?: GroupInset;
  /** The theme role it is drawn in. Unset, the theme's default role. */
  style?: string;
  /** The colors the author set by hand, which a theme leaves as they are. */
  ownStyle?: readonly StyleField[];
  /** The parts of its text face the author set by hand, which a theme leaves as they are. */
  ownFont?: readonly FontField[];
  /** On a built body whose rows are all text: how it stacks them, so it can be laid out again when
   *  their text changes size. Each row's text node carries its place as `bodyRow`. */
  body?: BodyLayout;
}

/** How a built body stacks its text rows: the `BodySpec` fields its layout reads, and how many rows. */
export interface BodyLayout {
  padding: number;
  gap: number;
  verticalAlign: 'top' | 'center' | 'bottom';
  rows: number;
}

/** The group half of a {@link DiagramNode}. */
export interface DiagramGroup {
  /** Room the box keeps around its members, in world units: one number for
   *  every side, or per side. Default 12 on each. */
  inset?: number | Partial<GroupInset>;
  /** The narrowest the box may be, in world units, as room for its label.
   *  A box its members leave narrower grows evenly on both sides. */
  minWidth?: number;
  /** The axis its members can be dragged along to change their order. */
  reorder?: 'x' | 'y';
}

/** A port resolved against a node's current pose: where it is in world
 *  coordinates, and which way an edge leaves it. */
export interface Port {
  id: string;
  /** The node this port belongs to. */
  nodeId: string;
  /** World point an edge attaches to. */
  point: Vec2;
  /** Unit vector pointing away from the node, or `null` when the port
   *  declared no direction. Rotated with the node. */
  normal: Vec2 | null;
  type?: string;
  label?: string;
}
