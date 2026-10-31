/** The scene specs `diagramScene` makes for edges and their labels. */
import { polylineFromPoints } from '@weasel-js/core';
import type { WireLabel } from './dataGroups';
import { EDGE_DERIVE_PATH } from './edge';
import type { MeasureRowText } from './body';
import type { DataEdge, DiagramSceneOptions, DiagramSpec } from './fromData';
import { ownEdgeStyle, withColors } from './dataColors';
import { END_LABEL_PLACEMENT, edgeLabelSpec, endLabelIdOf, labelSize, labelStyleOf } from './edgeLabel';
import { labelCenter } from './label';
import type { DiagramLabel } from './labelTrait';
import type { LayeredRoute } from './route';
import { dataEdgeStyle } from './dataStyles';
import { EDGE_STROKE_WIDTH } from './dataTypes';
import type { DiagramTheme } from './theme/types';
import type { OffPageSplit } from './offPage/trait';

export interface EdgeSpecContext {
  idOf: (edge: DataEdge) => string;
  font: { fontFamily: string; fontSize: number };
  /** The face labels are sized from. Default `font`. */
  labelFont?: { fontFamily: string; fontSize: number };
  measure: MeasureRowText;
  /** Styles each edge under its role. Unset, edges take `dataEdgeStyle`'s defaults. */
  theme?: DiagramTheme;
  labelPlacement: DiagramLabel;
  /** Ports and waypoints by edge id, overriding the edge's own (from `layeredRoutes`). */
  routes?: ReadonlyMap<string, LayeredRoute> | null;
  opts: Pick<DiagramSceneOptions, 'edgeStyle' | 'router' | 'labelPlacement'>;
  /** The off-page split of each edge, by id, that crosses between pages. */
  splits?: ReadonlyMap<string, OffPageSplit>;
}

/** Where a label sits: beside the room layout left it, at the edge's own
 *  offset or else the diagram's; else the edge's own placement, else the
 *  diagram's. */
function placementOf(e: DataEdge, route: LayeredRoute | undefined, ctx: EdgeSpecContext): DiagramLabel {
  const placement = e.labelPlacement ?? ctx.opts.labelPlacement ?? ctx.labelPlacement;
  return route?.labelAt === undefined ? placement : { ...placement, at: { near: route.labelAt } };
}

/** Each edge's label as a group's box takes it in: where it sits, when layout
 *  stationed it beside its waypoints, else only its id. */
export function wireLabels(edges: readonly DataEdge[], ctx: EdgeSpecContext): WireLabel[] {
  const out: WireLabel[] = [];
  for (const e of edges) {
    if (!e.label) continue;
    const id = ctx.idOf(e);
    const route = ctx.routes?.get(id);
    const size = labelSize(e.label, labelStyleOf(ctx.labelFont ?? ctx.font), ctx.measure);
    const placement = placementOf(e, route, ctx);
    const center = route?.waypoints !== undefined && typeof placement.at === 'object'
      ? labelCenter(polylineFromPoints([...route.waypoints]), placement, size)
      : null;
    out.push({
      id: `${id}/label`,
      from: e.from,
      to: e.to,
      at: center === null ? null : { x: center.x - size.width / 2, y: center.y - size.height / 2, ...size },
    });
  }
  return out;
}

/** An edge end naming `port`, marked as layout's when the author named none. */
const endOf = (own: string | undefined, port: string | undefined) =>
  !port ? {} : own === undefined ? { port, laidOut: port } : { port };

export function edgeSpecs(edges: readonly DataEdge[], ctx: EdgeSpecContext): DiagramSpec[] {
  const specs: DiagramSpec[] = [];
  for (const e of edges) {
    const id = ctx.idOf(e);
    const route = ctx.routes?.get(id);
    const router = e.router ?? ctx.opts.router ?? 'bezier';
    const planned = route ?? {
      fromPort: e.fromPort ?? e.routedPorts?.from,
      toPort: e.toPort ?? e.routedPorts?.to,
      waypoints: e.waypoints ?? e.routed,
    };
    const { fromPort, toPort } = planned;
    // An avoid connector's bends are routed, never stops.
    const waypoints = router === 'avoid' ? e.waypoints : planned.waypoints;
    // Layout's own route, marked so a later layout of the live scene owns it.
    const laidOut = e.waypoints === undefined && waypoints !== undefined;
    const own = ctx.opts.edgeStyle?.(e);
    const style = own !== undefined ? withColors(own, e.colors) : dataEdgeStyle(e, ctx.theme);
    const markerStart = style.markerStart ?? null;
    const markerEnd = style.markerEnd === undefined ? 'arrow' : style.markerEnd;
    const split = ctx.splits?.get(id);
    specs.push({
      id: id as never,
      kind: 'mark',
      layer: 'main',
      pickable: false,
      pose: { x: 0, y: 0, width: 0, height: 0 },
      data: {
        diagram: {
          from: endOf(e.fromPort, fromPort),
          to: endOf(e.toPort, toPort),
          router,
          ...(waypoints ? { waypoints } : {}),
          ...(laidOut ? { laidOut: waypoints } : {}),
          ...(e.style !== undefined ? { style: e.style } : {}),
          ...ownEdgeStyle(e.colors),
          ...(split !== undefined ? { offPage: split } : {}),
        },
        stroke: {
          paint: { color: style.stroke },
          width: style.width ?? EDGE_STROKE_WIDTH,
          ...(style.dash ? { dash: style.dash } : {}),
          ...(markerStart !== null ? { markerStart } : {}),
          ...(markerEnd !== null ? { markerEnd } : {}),
        },
      },
      dependsOn: [e.from as never, e.to as never],
      derivePath: EDGE_DERIVE_PATH,
    });
    const look = { layer: 'main' as const, style: labelStyleOf(ctx.labelFont ?? ctx.font), fill: style.label ?? style.stroke, measure: ctx.measure };
    for (const end of ['from', 'to'] as const) {
      const text = e.endLabels?.[end];
      if (!text) continue;
      const label = end === 'from' ? END_LABEL_PLACEMENT : { ...END_LABEL_PLACEMENT, at: 'end' as const };
      specs.push(edgeLabelSpec(id, text, { ...look, id: endLabelIdOf(id, end), label }) as DiagramSpec);
    }
    if (!e.label) continue;
    specs.push(edgeLabelSpec(id, e.label, { ...look, label: placementOf(e, route, ctx) }) as DiagramSpec);
  }
  return specs;
}
