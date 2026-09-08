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
import { outlinePath, type Bounds, type Outline } from './outline';
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
  return { minWidth: width + padding * 2, minHeight: height + padding * 2 };
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
  const width = Math.max(bounds.width - padding * 2, 0);
  let y = bounds.y + padding;
  return spec.rows.map((row, index) => {
    const h = measureRow(row, measure).height;
    const box: RowBox = { row, index, x: bounds.x + padding, y, width, height: h };
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
 */
export function bodyTrait(spec: BodySpec, bounds: Bounds, measure?: MeasureRowText): DiagramNode {
  const ports: PortSpec[] = [
    { id: 'n', at: COMPASS.n },
    { id: 'e', at: COMPASS.e },
    { id: 's', at: COMPASS.s },
    { id: 'w', at: COMPASS.w },
  ];
  if (bounds.height <= 0) return { ports };

  for (const box of layoutBody(spec, bounds, measure)) {
    if (box.row.kind !== 'ports') continue;
    const v = (box.y + box.height / 2 - bounds.y) / bounds.height;
    for (const p of box.row.left ?? []) {
      ports.push(withType({ id: p.id, at: { u: 0, v } }, p.type));
    }
    for (const p of box.row.right ?? []) {
      ports.push(withType({ id: p.id, at: { u: 1, v } }, p.type));
    }
  }
  return { ports };
}

function withType(spec: PortSpec, type: string | undefined): PortSpec {
  return type === undefined ? spec : { ...spec, type };
}

/** The outline path for a built body at `bounds` — what paints it, and what a
 *  perimeter-hugging port will eventually be placed on. */
export function bodyOutline(spec: BodySpec, bounds: Bounds) {
  return outlinePath(spec.outline, bounds);
}
