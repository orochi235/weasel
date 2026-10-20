/**
 * Handles on the ends of a selected edge — what makes an edge's end grabbable,
 * so a drag can carry it onto another shape (`reconnect`).
 *
 * Built the way the port affordance is: point regions with a `null`
 * `targetId` and no `hitKind`, composed into a layer whose id is the kind a
 * press reports. See `portAffordance` for why both matter.
 */
import {
  composeAffordanceLayer,
  type Affordance,
  type AffordanceRegion,
  type ChromeState,
  type CommandFill,
  type CommandStroke,
  type CursorSpec,
  type DerivedDep,
  type RenderLayer,
} from '@weasel-js/core';
import type { Vec2 } from '@weasel-js/core/math';
import { edgeRouter, type ResolvedRoute, type Router } from './edge';
import { diagramEdgeOf, type DiagramEdge } from './edgeTrait';
import type { GraphNodeLike } from './graph';
import { offersPorts, type ParticipantPose, type ParticipantSource } from './portAffordance';
import type { PortsOptions } from './ports';

/** The layer id the edge-end handles are composed into. */
export const EDGE_END_LAYER_ID = 'diagram-edge-ends';

/** The affordance kind a press on an edge-end handle reports. */
export const EDGE_END_AFFORDANCE_KIND = `layer:${EDGE_END_LAYER_ID}` as const;

/** What a press on an edge-end handle hands the reconnect action, as
 *  `InvocationCtx.drag.affordance.payload`. */
export interface EdgeEndScratch {
  targetId: string;
  edgeId: string;
  end: 'from' | 'to';
}

/** Read an edge-end press's scratch back off the hit an action was handed. */
export function edgeEndScratchOf(hit: { payload?: unknown } | null | undefined): EdgeEndScratch | null {
  const payload = hit?.payload as EdgeEndScratch | undefined;
  return payload !== undefined && typeof payload.edgeId === 'string'
    && (payload.end === 'from' || payload.end === 'to') ? payload : null;
}

/** An edge as it stands: its trait, the participants at its two ends, and
 *  where its routed path starts and ends. */
export interface EdgeEnds<TPose> {
  edge: ParticipantPose<TPose>;
  trait: DiagramEdge;
  from: ParticipantPose<TPose>;
  to: ParticipantPose<TPose>;
  points: { from: Vec2; to: Vec2 };
  /** The route as the edge's own `derivePath` draws it. */
  route: ResolvedRoute;
}

/** Options shared by the edge-end affordance and the reconnect action. */
export interface EdgeEndOptions<TPose> extends PortsOptions<TPose> {
  routers?: Readonly<Record<string, Router>>;
}

/** Resolves an edge's two ends from `participants`, routed as the edge's own
 *  `derivePath` routes it. `null` for a node that is not a drawable edge. */
export function createEdgeEnds<TPose>(participants: ParticipantSource<TPose>, opts: EdgeEndOptions<TPose> = {}) {
  const derive = edgeRouter<TPose>({
    ...(opts.geometry ? { geometry: opts.geometry } : {}),
    ...(opts.read ? { read: opts.read } : {}),
    ...(opts.routers ? { routers: opts.routers } : {}),
  });
  return function endsOf(edgeId: string): EdgeEnds<TPose> | null {
    const byId = new Map<string, ParticipantPose<TPose>>();
    for (const p of participants()) byId.set(p.node.id, p);
    const edge = byId.get(edgeId);
    if (edge === undefined) return null;
    const trait = diagramEdgeOf(edge.node);
    const deps = (edge.node as GraphNodeLike).dependsOn;
    if (trait === null || !Array.isArray(deps) || deps.length !== 2) return null;
    const from = byId.get(deps[0]!);
    const to = byId.get(deps[1]!);
    if (from === undefined || to === undefined) return null;
    const dep = (p: ParticipantPose<TPose>) => ({ node: p.node, pose: p.pose }) as unknown as DerivedDep<TPose>;
    const route = derive(edge.node, [dep(from), dep(to)]);
    const p = route?.points;
    if (route === null || p === undefined || p.length < 2) return null;
    return { edge, trait, from, to, points: { from: p[0]!, to: p[p.length - 1]! }, route };
  };
}

/** Options for {@link createEdgeEndAffordance}. */
export interface EdgeEndAffordanceOptions<TPose> extends EdgeEndOptions<TPose> {
  /** Also the chrome-caps visibility id. Default {@link EDGE_END_LAYER_ID}. */
  id?: string;
  /** Screen-pixel hit radius. Default 8. */
  hitRadiusPx?: number;
  /** Screen-pixel side of the painted square. Default 8; 0 paints nothing. */
  sizePx?: number;
  fill?: CommandFill;
  stroke?: CommandStroke;
  cursor?: CursorSpec;
}

const DEFAULT_HIT_PX = 8;
const DEFAULT_SIZE_PX = 8;

/** The affordance: one point region on each end of each selected edge. */
export function createEdgeEndAffordance<TPose>(
  participants: ParticipantSource<TPose>,
  selected: () => readonly string[],
  opts: EdgeEndAffordanceOptions<TPose> = {},
): Affordance {
  const { id = EDGE_END_LAYER_ID, hitRadiusPx = DEFAULT_HIT_PX, sizePx = DEFAULT_SIZE_PX } = opts;
  const endsOf = createEdgeEnds(participants, opts);
  const look = { ...(opts.fill ? { fill: opts.fill } : {}), ...(opts.stroke ? { stroke: opts.stroke } : {}) };
  const paint = sizePx > 0 ? { paint: { kind: 'square' as const, sizePx, ...look } } : {};

  return {
    id,
    regions(state: ChromeState): readonly AffordanceRegion[] {
      const out: AffordanceRegion[] = [];
      for (const edgeId of selected()) {
        const ends = endsOf(edgeId);
        if (ends === null || !offersPorts(ends.edge, state)) continue;
        for (const end of ['from', 'to'] as const) {
          const at = ends.points[end];
          out.push({
            id: `${edgeId}:${end}`,
            targetId: null,
            shape: { kind: 'point', x: at.x, y: at.y, hitRadiusPx },
            ...paint,
            ...(opts.cursor !== undefined ? { cursor: opts.cursor } : {}),
            strength: 'exclusive',
            claimedKinds: ['pointer'],
            bind: () => ({ initialScratch: { targetId: edgeId, edgeId, end } satisfies EdgeEndScratch }),
          });
        }
      }
      return out;
    },
  };
}

/** The composed layer, for `CanvasExtensionApi.registerLayer`. Register it
 *  after the port layer: the last-registered layer is hit first, and an edge's
 *  end sits on a port. */
export function edgeEndLayer<TPose>(
  participants: ParticipantSource<TPose>,
  selected: () => readonly string[],
  opts: EdgeEndAffordanceOptions<TPose> = {},
): RenderLayer<unknown> {
  return composeAffordanceLayer(
    opts.id ?? EDGE_END_LAYER_ID,
    'Diagram edge ends',
    [createEdgeEndAffordance(participants, selected, opts)],
  ) as unknown as RenderLayer<unknown>;
}
