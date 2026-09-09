/**
 * The optional body builder: what a node looks like when it should read as a
 * flowchart box or a visual-programming operator, rather than as whatever
 * scene node it already was.
 *
 * **The body measures a floor; the author sets the rest.** Rows measure to a
 * `{ minWidth, minHeight }` and the node's pose is the max of that and what
 * the author gave it. Adding a port row can grow a node; nothing here ever
 * shrinks one back. Because the pose stays authored data, resize, align,
 * distribute, guides, snapping and undo need no special case, and a node that
 * did not come from the builder just has whatever size it already had.
 *
 * Text measurement is a seam rather than an import: measuring needs a 2D
 * context, which a geometry module has no business owning. `canvasMeasure`
 * adapts the kit's own `measureText` for a caller that has one.
 */
import { boxForContent, contentBox, outlinePath, type Bounds, type Outline } from './outline';
import { COMPASS } from './ports';
import type { DiagramNode, PortSpec } from './types';

/** One line of body content. */
export type Row =
  /** Text. `label` is the node's name; `field` is a named value. */
  | { kind: 'label'; text: string; style?: RowTextStyle }
  | { kind: 'field'; label: string; value: string; style?: RowTextStyle }
  /** A row that carries ports on its own left and right edges — the
   *  visual-programming shape, where an operator's inputs line up with the
   *  rows they feed. */
  | { kind: 'ports'; left?: readonly RowPort[]; right?: readonly RowPort[]; height?: number }
  /** Reserved space a consumer paints into. */
  | { kind: 'slot'; height: number; id?: string };

/** A port declared on a row rather than on the node's perimeter. */
export interface RowPort {
  id: string;
  /** Label shown beside it, and what the row measures against. */
  label?: string;
  type?: string;
}

/** The subset of a text style the body measures against. Deliberately small:
 *  a full `ResolvedTextStyle` belongs to whatever paints the row. */
export interface RowTextStyle {
  fontSize?: number;
  fontFamily?: string;
  bold?: boolean;
}

/** Measures one run of text. Returns its advance width and its line height. */
export type MeasureRowText = (text: string, style: RowTextStyle) => { width: number; height: number };

export interface BodySpec {
  outline: Outline;
  rows: readonly Row[];
  /** Space between the outline and its rows. Default 8. */
  padding?: number;
  /** Space between adjacent rows. Default 4. */
  gap?: number;
}

/** What {@link buildBody} emits: the `AddNodeSpec` fields it fills in. Named
 *  structurally rather than imported so a consumer whose scene is typed
 *  differently can still spread one. */
export interface BodyNodeSpec<TData, TLayer extends string, TPose> {
  kind: 'container' | 'leaf';
  layer: TLayer;
  pose: TPose;
  data: TData;
  id?: string;
  parent?: string;
}

/** The floor a body's content puts under its node's size. */
export interface BodyFloor {
  minWidth: number;
  minHeight: number;
}

/** Where one row landed, in the same frame as the bounds it was laid out in.
 *  A `ports` row's own ports anchor to this box. */
export interface RowBox extends Bounds {
  row: Row;
  index: number;
}

const DEFAULT_PADDING = 8;
const DEFAULT_GAP = 4;
/** What a row is worth when nothing measures its text. Enough that a body
 *  laid out headlessly is not zero-height — a zero-height body renders as an
 *  empty page with every unit test still green. */
const FALLBACK_LINE = 16;

/** Adapts the kit's `measureText` for a caller holding a 2D context. Pass the
 *  same context the renderer measures with, or the floor will not match what
 *  is painted. */
export function canvasMeasure(
  ctx: { measureText(text: string): { width: number } ; font: string },
): MeasureRowText {
  return (text, style) => {
    const size = style.fontSize ?? FALLBACK_LINE;
    ctx.font = `${style.bold === true ? 'bold ' : ''}${size}px ${style.fontFamily ?? 'sans-serif'}`;
    return { width: ctx.measureText(text).width, height: Math.ceil(size * 1.2) };
  };
}

/** What each row is worth on its own, before padding and gaps. */
function measureRow(row: Row, measure: MeasureRowText | undefined): { width: number; height: number } {
  const text = (s: string, style?: RowTextStyle): { width: number; height: number } =>
    measure === undefined
      ? { width: s.length * (((style?.fontSize ?? FALLBACK_LINE) * 0.6)), height: FALLBACK_LINE }
      : measure(s, style ?? {});

  switch (row.kind) {
    case 'label':
      return text(row.text, row.style);
    case 'field': {
      // Label and value sit on one line with a gap between them.
      const l = text(row.label, row.style);
      const v = text(row.value, row.style);
      return { width: l.width + DEFAULT_GAP * 2 + v.width, height: Math.max(l.height, v.height) };
    }
    case 'ports': {
      const side = (ports: readonly RowPort[] | undefined): number =>
        (ports ?? []).reduce((w, p) => Math.max(w, p.label === undefined ? 0 : text(p.label).width), 0);
      const rows = Math.max(row.left?.length ?? 0, row.right?.length ?? 0, 1);
      return {
        width: side(row.left) + DEFAULT_GAP * 2 + side(row.right),
        height: row.height ?? rows * FALLBACK_LINE,
      };
    }
    case 'slot':
      return { width: 0, height: row.height };
  }
}

/**
 * The smallest box `spec`'s rows fit in. A node's pose is maxed against this,
 * never set to it.
 */
export function measureBody(spec: BodySpec, measure?: MeasureRowText): BodyFloor {
  const padding = spec.padding ?? DEFAULT_PADDING;
  const gap = spec.gap ?? DEFAULT_GAP;
  let width = 0;
  let height = 0;
  for (const [i, row] of spec.rows.entries()) {
    const m = measureRow(row, measure);
    width = Math.max(width, m.width);
    height += m.height + (i > 0 ? gap : 0);
  }
  // The rows fit the *content* box; the node's own box has to be whatever
  // contains that, or a diamond's label lands outside the diamond.
  const box = boxForContent(spec.outline, {
    width: width + padding * 2,
    height: height + padding * 2,
  });
  return { minWidth: box.width, minHeight: box.height };
}

/**
 * The authored size, grown to fit the body. Never shrinks: a row removed
 * leaves the node the size the author last saw it at, which is the only
 * behavior that survives a resize the author did on purpose.
 */
export function sizeToBody<TPose extends Bounds>(pose: TPose, floor: BodyFloor): TPose {
  const width = Math.max(pose.width, floor.minWidth);
  const height = Math.max(pose.height, floor.minHeight);
  if (width === pose.width && height === pose.height) return pose;
  return { ...pose, width, height };
}

/** Where each row sits inside `bounds`, top to bottom. Rows keep their
 *  measured heights; the leftover goes unclaimed at the bottom rather than
 *  being distributed, so a row does not move when a sibling grows. */
export function layoutBody(
  spec: BodySpec,
  bounds: Bounds,
  measure?: MeasureRowText,
): RowBox[] {
  const padding = spec.padding ?? DEFAULT_PADDING;
  const gap = spec.gap ?? DEFAULT_GAP;
  const inner = contentBox(spec.outline, bounds);
  const width = Math.max(inner.width - padding * 2, 0);
  let y = inner.y + padding;
  return spec.rows.map((row, index) => {
    const h = measureRow(row, measure).height;
    const box: RowBox = { row, index, x: inner.x + padding, y, width, height: h };
    y += h + gap;
    return box;
  });
}

/**
 * The `DiagramNode` trait a built body implies: perimeter ports for the
 * outline, plus one port per `ports`-row entry, anchored to that row's own
 * left or right edge.
 *
 * Anchors are normalized against `bounds`, so they survive the node being
 * resized — which is the whole reason `PortAnchor` is normalized.
 *
 * **A row port on a side takes that side's compass default with it.** Both sit
 * on the same edge, and a row near the vertical middle puts one exactly on top
 * of `w` or `e` — where the later region wins the hit and the other is
 * grabbable nowhere. A body that declares where its inputs attach has said what
 * that side is for.
 */
export function bodyTrait(spec: BodySpec, bounds: Bounds, measure?: MeasureRowText): DiagramNode {
  const outline = spec.outline;
  const compass: PortSpec[] = [
    { id: 'n', at: COMPASS.n },
    { id: 'e', at: COMPASS.e },
    { id: 's', at: COMPASS.s },
    { id: 'w', at: COMPASS.w },
  ];
  if (bounds.height <= 0) return { outline, ports: compass };

  const rowPorts: PortSpec[] = [];
  let hasLeft = false;
  let hasRight = false;
  for (const box of layoutBody(spec, bounds, measure)) {
    if (box.row.kind !== 'ports') continue;
    const v = (box.y + box.height / 2 - bounds.y) / bounds.height;
    for (const p of box.row.left ?? []) {
      hasLeft = true;
      rowPorts.push(withType({ id: p.id, at: { u: 0, v } }, p.type));
    }
    for (const p of box.row.right ?? []) {
      hasRight = true;
      rowPorts.push(withType({ id: p.id, at: { u: 1, v } }, p.type));
    }
  }
  const kept = compass.filter((p) =>
    !(p.id === 'w' && hasLeft) && !(p.id === 'e' && hasRight));
  return { outline, ports: [...kept, ...rowPorts] };
}

function withType(spec: PortSpec, type: string | undefined): PortSpec {
  return type === undefined ? spec : { ...spec, type };
}

/** The outline path for a built body at `bounds` — what paints it, and what a
 *  perimeter-hugging port will eventually be placed on. */
export function bodyOutline(spec: BodySpec, bounds: Bounds) {
  return outlinePath(spec.outline, bounds);
}

/** What a built body's rows are handed to, one call per row.
 *
 *  `text` is the row's content already formatted — a `label`'s own text, or a
 *  `field`'s `"label: value"` — so the common case needs no discrimination.
 *  Return `null` for a row the consumer paints itself; `ports` and `slot` rows
 *  arrive with `text` empty and are the usual ones to decline. */
export type RowNodeData<TData> = (text: string, box: RowBox) => TData | null;

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
}

/**
 * The scene nodes a built body is: one container carrying the trait, and one
 * leaf per row that wants drawing.
 *
 * Rows are ordinary scene nodes rather than something this package paints, so
 * the kit's own text painter draws them and text editing, styling and
 * selection work on them unchanged. The walk that places them is
 * `layoutBody` — the same one `bodyTrait` anchors its row ports against, which
 * is why a label and its ports cannot drift apart.
 *
 * The pose is `sizeToBody(at, measureBody(spec))`: the body measures a floor
 * and the authored size is grown to clear it, never shrunk.
 */
export function buildBody<TData, TLayer extends string, TPose extends Bounds>(
  spec: BodySpec,
  at: TPose,
  opts: BuildBodyOptions<TData, TLayer, TPose>,
): { pose: TPose; specs: BodyNodeSpec<TData, TLayer, TPose>[] } {
  const pose = sizeToBody(at, measureBody(spec, opts.measure));
  const specs: BodyNodeSpec<TData, TLayer, TPose>[] = [{
    kind: 'container',
    layer: opts.layer,
    pose,
    data: opts.body(bodyTrait(spec, pose, opts.measure), pose),
    ...(opts.id === undefined ? {} : { id: opts.id }),
  }];

  for (const box of layoutBody(spec, pose, opts.measure)) {
    const data = opts.row(rowText(box.row), box);
    if (data === null) continue;
    specs.push({
      kind: 'leaf',
      layer: opts.layer,
      pose: { ...pose, x: box.x, y: box.y, width: box.width, height: box.height },
      data,
      ...(opts.id === undefined ? {} : { parent: opts.id }),
    });
  }
  return { pose, specs };
}

/** A row's content as one string: empty for a row that carries no text. */
function rowText(row: Row): string {
  if (row.kind === 'label') return row.text;
  if (row.kind === 'field') return `${row.label}: ${row.value}`;
  return '';
}
