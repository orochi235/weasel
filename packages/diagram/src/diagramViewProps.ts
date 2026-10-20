import type { Contribution, Paint, RectPose, View } from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import type { CanConnect } from './connect';
import type { DiagramContributionOptions } from './contribution';
import type { DataEdge, DiagramSpec } from './fromData';
import type { LayoutFn, LayoutPlanner } from './layout';
import type { LiveLayout, UseLiveLayoutOptions } from './live';
import type { DiagramOverlay } from './overlays';
import type { ReorderChange } from './groupReorder';
import type { EdgeRoute, NodeMove } from './sceneSync';

/** One end of a data edge moved onto node `node`, at `port` or on its body. */
export interface ReconnectChange {
  /** The data edge's id, `edgeIdOf` of it. */
  edge: string;
  end: 'from' | 'to';
  node: string;
  port?: string;
}

/** A data edge's route as a drag or a double-click left it. */
export interface RouteChange {
  /** The data edge's id, `edgeIdOf` of it. */
  edge: string;
  /** Empty when the edge no longer has any. */
  waypoints: readonly Vec2[];
}

/** What a delete would take: the data nodes, and every data edge that goes with them. */
export interface DeleteReport {
  nodes: readonly string[];
  edges: readonly string[];
}

/** Props for `DiagramView`. */
export interface DiagramViewProps {
  /** Every spec needs an id, which `diagramScene` gives them. A new array is
   *  reconciled into the scene the view already holds, so the view, the
   *  selection and anything moved since stay put unless the new specs change
   *  them. Pass a new `key` to start over instead. */
  specs: readonly DiagramSpec[];
  /** `'avoid'` routes every edge around the shapes, holding one router across
   *  new `specs` so each reroutes only what it disturbed. The routes derive
   *  from the specs and are never reported. */
  router?: 'avoid';
  /** The view opens fitted to the diagram, and fits again when the size or a
   *  fit option changes or a layout run settles, until the user pans or zooms;
   *  from then on the view is theirs. Omit both to fill the parent, which
   *  then needs a size of its own; a resize of the parent is a size change. */
  width?: number;
  height?: number;
  /** A participant id, or null for none. */
  selected?: string | null;
  /** Reports what each click leaves picked, `null` for none — a re-click on the
   *  picked node reports it again. The canvas keeps the pick even if
   *  `selected` does not follow it; only a change to `selected` is pushed in. */
  onSelect?: (id: string | null) => void;
  /** Reports the node, group or edge the pointer comes to be over, and `null`
   *  once it is over none or leaves the canvas. An edge answers only while
   *  edges are picked (`pickEdges`). */
  onHover?: (id: string | null) => void;
  /** Whether a click or a hover can land on an edge, which is then picked
   *  like a node. Default: on when `onReconnect`, `onDelete` or
   *  `onEditLabel` is set. */
  pickEdges?: boolean;
  /** DOM held against nodes, groups and edges, kept in place through pans,
   *  zooms, resizes and layout runs. The view's box is their containing
   *  block; their content takes the pointer, and the canvas beneath does not
   *  see it. */
  overlays?: readonly DiagramOverlay[];
  /** Set to let nodes be dragged. Reports every node a drag or a layout run
   *  moved, and every edge whose route or ports a layout run rewrote. Store
   *  each move as the data node's `at` with `pinned: true`, and each route as
   *  the data edge's `routed` and `routedPorts`, or the next `diagramScene`
   *  lays them out again. */
  onMove?: (moves: readonly NodeMove[], routes: readonly EdgeRoute[]) => void;
  /** Ports are grabbable when this is set, unless `ports` says otherwise. Dragging one port onto another reports the
   *  edge it describes and draws nothing; add it to the data to keep it. An
   *  end on a shape's body (`connectBodies`) has no port field. */
  onConnect?: (edge: DataEdge) => void;
  /** Set to let a selected edge's ends be dragged onto another port, or with
   *  `connectBodies` onto a shape's body. Reports the move and draws nothing; change the data edge to keep it. */
  onReconnect?: (change: ReconnectChange) => void;
  /** Set to give a selected edge handles along its route: drag one to move or
   *  insert a waypoint, or slide an orthogonal segment; double-click one to
   *  remove it. Reports the edge's new waypoints and draws nothing; store them
   *  as the data edge's `waypoints` and clear its `routed`. */
  onEditRoute?: (change: RouteChange) => void;
  /** Set to let Delete and Backspace remove the selection. Reports the
   *  selected data nodes (a selected group, not its members) and every edge
   *  selected or ending on one of them, and removes nothing. */
  onDelete?: (removed: DeleteReport) => void;
  /** Set to let a member of a group marked `reorder` be dragged along that
   *  axis among its siblings, or the selected one stepped with Alt and an
   *  arrow key. Reports the members' new order and moves nothing: write it to
   *  the group's `members`, which layered layout keeps. */
  onReorder?: (change: ReorderChange) => void;
  /** Set to report a double-click on an edge, for its label to be edited. */
  onEditLabel?: (edge: string) => void;
  /** Whether a connect or a reconnect may end on a shape's body, away from
   *  its ports. Default false. */
  connectBodies?: boolean;
  /** Contributions to install after the view's own: a tool's bindings, a key. */
  ambient?: readonly Contribution[];
  /** Whether ports are drawn. `'connect'` draws them and lets one be dragged
   *  onto another; `'show'` only draws them. Default: `'connect'` when
   *  `onConnect` is set, else `'none'`. */
  ports?: 'connect' | 'show' | 'none';
  /** Whether the canvas's keyboard shortcuts — held Space to pan among them —
   *  run. They listen page-wide, so a view-only diagram beside other UI would
   *  claim keys meant for the page. Default: on when any callback that edits
   *  is set. */
  enableKeybindings?: boolean;
  /** Which ports may be joined. Default: a port may not join itself, and two
   *  typed ports must share a type. */
  canConnect?: CanConnect;
  /** How ports look and answer the pointer, and the router a connect's
   *  preview draws with. */
  portOptions?: Pick<
    DiagramContributionOptions<RectPose>,
    'fill' | 'stroke' | 'shape' | 'sizePx' | 'hitRadiusPx' | 'cursor' | 'shows' | 'showsPort' | 'snapRadius' | 'router'
  >;
  /** How a layout run from {@link DiagramViewApi.layout} behaves: its forces,
   *  how many frames an eased layout takes, its easing, and `onError`, which
   *  hears a `LayoutPlanner` that failed to answer. */
  live?: Omit<UseLiveLayoutOptions<RectPose>, 'scene' | 'source' | 'algorithm'>;
  /** The smallest scale the fit may use. Unset, the whole diagram fits
   *  however small that makes it; set, it stops here and the rest is a pan away. */
  minScale?: number;
  /** The largest scale the fit may use. Default 1, so a small
   *  diagram opens at its own size rather than blown up. */
  maxScale?: number;
  /** Which part of a diagram too big for the box it opens on: its middle
   *  (default) or its top-left, where a layered flow begins. */
  anchor?: 'center' | 'start';
  /** Space kept clear around the diagram by the fit, in CSS pixels.
   *  Default 16. */
  fitPadding?: number;
  /** What the canvas paints behind the diagram. Unset, it is transparent. */
  background?: Paint;
  /** The view, controlled. Set it and the fit is skipped; pair it
   *  with `onViewChange` or panning does nothing. */
  view?: View;
  /** Every view change, from a pan, a zoom or a refit. */
  onViewChange?: (view: View) => void;
  className?: string;
}

/** What a `ref` on `DiagramView` holds. */
export interface DiagramViewApi {
  /** Lay the diagram out again from where its nodes stand, animated. `'force'`
   *  (default) relaxes until it settles; any other layout eases to its answer.
   *  A `LayoutPlanner` is handed the diagram's graph and eased to once it
   *  answers; a drag, an edit or another `layout` call before then drops the
   *  answer. What moved is reported to `onMove` once the run settles. */
  layout(algorithm?: DiagramLayout): void;
  /** The run `layout` started: stop it where it stands, or cancel it. */
  live: LiveLayout;
  /** The world point under a client point: where a drop from outside the canvas lands. */
  worldAt(clientX: number, clientY: number): Vec2;
  /** The world rect the canvas shows, or `null` before it has a size. */
  visible(): { x: number; y: number; width: number; height: number } | null;
  /** Where a node, group or edge is drawn, in client coordinates — for an
   *  edge, an empty rect at the midpoint along its route. `null` for an id the
   *  diagram does not hold, or before the canvas mounts. Read it again from
   *  {@link subscribeFrame}, after every paint. */
  rectOf(id: string): { x: number; y: number; width: number; height: number } | null;
  /** Run `fn` after every paint: a pan, a zoom, a layout frame, a change of
   *  specs. Returns an unsubscribe; a call before the canvas mounts returns one
   *  and never runs `fn`. */
  subscribeFrame(fn: () => void): () => void;
}

/** What {@link DiagramViewApi.layout} runs. */
export type DiagramLayout = 'layered' | 'tree' | 'force' | 'chain' | LayoutFn | LayoutPlanner;
