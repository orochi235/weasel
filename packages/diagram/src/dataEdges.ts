/** The scene specs `diagramScene` makes for edges and their labels. */
import { EDGE_DERIVE_PATH } from './edge';
import type { MeasureRowText } from './body';
import type { DataEdge, DiagramSceneOptions, DiagramSpec, EdgeStyle } from './fromData';
import { LABEL_DERIVE_POSE, type DiagramLabel } from './label';
import type { LayeredRoute } from './route';

export interface EdgeSpecContext {
  idOf: (edge: DataEdge) => string;
  font: { fontFamily: string; fontSize: number };
  measure: MeasureRowText;
  fallback: EdgeStyle;
  labelPlacement: DiagramLabel;
  /** Ports and waypoints by edge id, overriding the edge's own (from `layeredRoutes`). */
  routes?: ReadonlyMap<string, LayeredRoute> | null;
  opts: Pick<DiagramSceneOptions, 'edgeStyle' | 'router' | 'labelPlacement'>;
}

/** The face an edge label is set in: the diagram's, two sizes down. */
export const labelStyleOf = (font: { fontFamily: string; fontSize: number }) => ({ ...font, fontSize: font.fontSize - 2 });

/** Where a label sits: beside the room layout left it, at the edge's own
 *  offset or else the diagram's; else the edge's own placement, else the
 *  diagram's. */
function placementOf(e: DataEdge, route: LayeredRoute | undefined, ctx: EdgeSpecContext): DiagramLabel {
  const placement = e.labelPlacement ?? ctx.opts.labelPlacement ?? ctx.labelPlacement;
  return route?.labelAt === undefined ? placement : { ...placement, at: { waypoint: route.labelAt } };
}

/** An edge end naming `port`, marked as layout's when the author named none. */
const endOf = (own: string | undefined, port: string | undefined) =>
  !port ? {} : own === undefined ? { port, laidOut: port } : { port };

export function edgeSpecs(edges: readonly DataEdge[], ctx: EdgeSpecContext): DiagramSpec[] {
  const specs: DiagramSpec[] = [];
  for (const e of edges) {
    const id = ctx.idOf(e);
    const route = ctx.routes?.get(id);
    const { fromPort, toPort, waypoints } = route ?? e;
    // Layout's own route, marked so a later layout of the live scene owns it.
    const laidOut = e.waypoints === undefined && waypoints !== undefined;
    const style = ctx.opts.edgeStyle?.(e) ?? ctx.fallback;
    const markerStart = style.markerStart ?? null;
    const markerEnd = style.markerEnd === undefined ? 'arrow' : style.markerEnd;
    specs.push({
      id: id as never,
      kind: 'leaf',
      layer: 'main',
      pickable: false,
      pose: { x: 0, y: 0, width: 0, height: 0 },
      data: {
        diagram: {
          from: endOf(e.fromPort, fromPort),
          to: endOf(e.toPort, toPort),
          router: e.router ?? ctx.opts.router ?? 'bezier',
          ...(waypoints ? { waypoints } : {}),
          ...(laidOut ? { laidOut: waypoints } : {}),
        },
        stroke: {
          paint: { color: style.stroke },
          width: style.width ?? 1.5,
          ...(style.dash ? { dash: style.dash } : {}),
          ...(markerStart !== null ? { markerStart } : {}),
          ...(markerEnd !== null ? { markerEnd } : {}),
        },
      },
      dependsOn: [e.from as never, e.to as never],
      derivePath: EDGE_DERIVE_PATH,
    });
    if (!e.label) continue;
    const labelStyle = labelStyleOf(ctx.font);
    specs.push({
      id: `${id}/label` as never,
      kind: 'leaf',
      layer: 'main',
      pickable: false,
      pose: { x: 0, y: 0, width: ctx.measure(e.label, labelStyle).width, height: labelStyle.fontSize },
      data: {
        diagram: { label: placementOf(e, route, ctx) },
        text: e.label,
        style: labelStyle,
        fill: { paint: { color: style.label ?? style.stroke } },
      },
      dependsOn: [id as never],
      derivePose: LABEL_DERIVE_POSE as never,
    });
  }
  return specs;
}
