/**
 * A body as scene nodes: one container carrying the trait, and one leaf per
 * row, row port label and perimeter port label that wants drawing.
 */
import { bodyTrait, labelSize, layoutBody, layoutRowPorts, measureBody, sizeToBody } from './body';
import type { BodySpec, MeasureRowText, Row, RowBox, RowPortBox } from './body';
import type { Bounds } from './outline';
import { portLabelsOf, type PerimeterPortLabelBox } from './portLabels';
import type { DiagramNode } from './types';

/** What {@link buildBody} emits: the `AddNodeSpec` fields it fills in. Named
 *  structurally rather than imported so a consumer whose scene is typed
 *  differently can still spread one. */
export interface BodyNodeSpec<TData, TLayer extends string, TPose> {
  kind: 'group' | 'mark';
  layer: TLayer;
  pose: TPose;
  data: TData;
  id?: string;
  parent?: string;
  /** Set `false` on every leaf the builder emits: the innermost hit wins, so a
   *  row that answers a press is a body that cannot be dragged. */
  pickable?: boolean;
}

/** What a built body's rows are handed to, one call per row.
 *
 *  `text` is the row's content already formatted — a `label`'s own text, or a
 *  `field`'s `"label: value"` — so the common case needs no discrimination.
 *  Return `null` for a row the consumer paints itself; `ports` and `slot` rows
 *  arrive with `text` empty and are the usual ones to decline. */
export type RowNodeData<TData> = (text: string, box: RowBox) => TData | null;

/** Options for {@link buildBody}: the layer and data of each node it emits.
 *  Without `measure`, rows are sized from a fallback line height rather than
 *  their text. */
export interface BuildBodyOptions<TData, TLayer extends string, TPose extends Bounds> {
  layer: TLayer;
  /** The container's id. Edges name it, so pass one for anything an edge or a
   *  layout `pin` will refer to. */
  id?: string;
  measure?: MeasureRowText;
  /** The container's own data, given the trait the builder computed and the
   *  pose it was computed against. */
  body: (trait: DiagramNode, pose: TPose) => TData;
  /** One row's data, or `null` to leave that row undrawn. */
  row: RowNodeData<TData>;
  /** One port's label — a row port's or a perimeter port's — or `null` to
   *  leave it undrawn. Ports with no label are never offered. Omit to draw none. */
  portLabel?: (text: string, box: RowPortBox | PerimeterPortLabelBox) => TData | null;
}

/**
 * The scene nodes a built body is: one container carrying the trait, and one
 * leaf per row that wants drawing.
 *
 * Rows are ordinary scene nodes rather than something this package paints, so
 * the kit's own text painter draws them and text editing, styling, and
 * selection work on them unchanged. The returned pose is `at` grown to fit the
 * body, never shrunk.
 */
export function buildBody<TData, TLayer extends string, TPose extends Bounds>(
  spec: BodySpec,
  at: TPose,
  opts: BuildBodyOptions<TData, TLayer, TPose>,
): { pose: TPose; specs: BodyNodeSpec<TData, TLayer, TPose>[] } {
  const pose = sizeToBody(at, measureBody(spec, opts.measure));
  const trait = bodyTrait(spec, pose, opts.measure);
  const specs: BodyNodeSpec<TData, TLayer, TPose>[] = [{
    kind: 'mark',
    layer: opts.layer,
    pose,
    data: opts.body(trait, pose),
    ...(opts.id === undefined ? {} : { id: opts.id }),
  }];

  const leaf = (box: Bounds, data: TData, rowId?: string): void => {
    specs.push({
      kind: 'mark',
      layer: opts.layer,
      pose: { ...pose, x: box.x, y: box.y, width: box.width, height: box.height },
      data,
      pickable: false,
      ...(opts.id === undefined ? {} : { parent: opts.id }),
      ...(opts.id !== undefined && rowId !== undefined ? { id: `${opts.id}/${rowId}` } : {}),
    });
  };

  const portLabel = opts.portLabel;
  for (const box of layoutBody(spec, pose, opts.measure)) {
    const data = opts.row(rowText(box.row), box);
    if (data !== null) leaf(box, data, 'id' in box.row ? box.row.id : undefined);
    if (portLabel === undefined || box.row.kind !== 'ports') continue;
    for (const pb of layoutRowPorts(box.row, box, opts.measure)) {
      if (pb.port.label === undefined) continue;
      const labelData = portLabel(pb.port.label, pb);
      if (labelData !== null) leaf(pb, labelData);
    }
  }
  const perimeter = portLabel === undefined ? [] : portLabelsOf(trait, pose, labelSize(opts.measure));
  for (const { port, box } of perimeter) {
    const labelData = portLabel!(port.label, { ...box, port: trait.ports!.find((p) => p.id === port.id)!, side: 'outside' });
    if (labelData !== null) leaf(box, labelData);
  }
  return { pose, specs };
}

/** A row's content as one string: empty for a row that carries no text. */
function rowText(row: Row): string {
  if (row.kind === 'label') return row.text;
  if (row.kind === 'field') return `${row.label}: ${row.value}`;
  return '';
}
