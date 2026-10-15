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

export function edgeSpecs(edges: readonly DataEdge[], ctx: EdgeSpecContext): DiagramSpec[] {
  const specs: DiagramSpec[] = [];
  for (const e of edges) {
    const id = ctx.idOf(e);
    const { fromPort, toPort, waypoints } = ctx.routes?.get(id) ?? e;
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
          from: fromPort ? { port: fromPort } : {},
          to: toPort ? { port: toPort } : {},
          router: e.router ?? ctx.opts.router ?? 'bezier',
          ...(waypoints ? { waypoints } : {}),
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
    const labelStyle = { ...ctx.font, fontSize: ctx.font.fontSize - 2 };
    specs.push({
      id: `${id}/label` as never,
      kind: 'leaf',
      layer: 'main',
      pickable: false,
      pose: { x: 0, y: 0, width: ctx.measure(e.label, labelStyle).width, height: labelStyle.fontSize },
      data: {
        diagram: { label: e.labelPlacement ?? ctx.opts.labelPlacement ?? ctx.labelPlacement },
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
