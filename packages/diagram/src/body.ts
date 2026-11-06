/**
 * The optional body builder: what a node looks like when it should read as a
 * flowchart box or a visual-programming operator, rather than as whatever
 * scene node it already was.
 *
 * **The body measures a floor; the author sets the rest.** Rows measure to a
 * `{ minWidth, minHeight }` and the node's pose is the max of that and what
 * the author gave it. Adding a port row can grow a node; nothing here ever
 * shrinks one back.
 *
 * Text measurement is a seam rather than an import: measuring needs a 2D
 * context, which a geometry module has no business owning.
 */
import { boxForContent, contentBox, outlinePath, type Bounds, type Outline } from './outline';
import { marginOf, portLabelsOf, withLabels } from './portLabels';
import { DEFAULT_PORTS } from './ports';
import { FALLBACK_LINE, trackingWidth } from './rowMeasure';
import type { DiagramNode, HeaderBand, PortSpec } from './types';

/** One line of body content. */
export type Row =
  /** A title band across the top of the node, flush with its bounds rather
   *  than inset by the outline or the padding, filled in the body's stroke.
   *  Only ever the first row. `pad` is the room above and below its text,
   *  default {@link HEADER_PAD}. */
  | { kind: 'header'; text: string; style?: RowTextStyle; id?: string; pad?: number }
  /** Text. `label` is the node's name; `field` is a named value. A row with
   *  an `id` gets a scene node of that name under the body's, so it can be
   *  found again; one without is named by its place. Not a bare number. */
  | { kind: 'label'; text: string; style?: RowTextStyle; id?: string }
  /** `room` is a value the row is measured as at least as wide as, so a
   *  value written in later fits the box it already has. */
  | { kind: 'field'; label: string; value: string; style?: RowTextStyle; id?: string; room?: string }
  /** A row that carries ports on its own left and right edges. */
  | { kind: 'ports'; left?: readonly RowPort[]; right?: readonly RowPort[]; height?: number }
  /** Reserved space a consumer paints into. With a `width`, the body is at
   *  least that wide and the slot's box is that wide, centered in its row. */
  | { kind: 'slot'; height: number; width?: number; id?: string }
  /** A rule across the content box, drawn in the body's own stroke by the
   *  outline painter. `inset` stops it that far short of each side. */
  | { kind: 'divider'; inset?: number };

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
  italic?: boolean;
  /** Extra space after each character, in em. */
  tracking?: number;
  /** A numeric font weight, over `bold`. */
  weight?: number;
}

/** Measures one run of text. Returns its advance width and its line height, and, when the face's
 *  metrics are known, `capCenter`: how far below the top of its line box the point midway between
 *  its baseline and its cap height falls, which a header centers in its band. */
export type MeasureRowText = (text: string, style: RowTextStyle) => { width: number; height: number; capCenter?: number };

/** A body's content: the outline it draws and the rows stacked inside it. */
export interface BodySpec {
  outline: Outline;
  rows: readonly Row[];
  /** Space between the outline and its rows. Default 8. */
  padding?: number;
  /** Space between adjacent rows. Default 4. */
  gap?: number;
  /** Where the rows sit as a block when the body is taller than they need. Default `'center'`. */
  verticalAlign?: 'top' | 'center' | 'bottom';
  /** The perimeter ports, replacing the four compass midpoints. A `ports`
   *  row's own ports are added either way. */
  ports?: readonly PortSpec[];
  /** Perimeter port labels by id, drawn outside the box; over a port's own `label`. */
  portLabels?: Readonly<Record<string, string>>;
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

/** Where one row port's label sits, in the same frame as the row box it was
 *  laid out in. Its vertical center is also where the port itself attaches, so
 *  a label and the port it names cannot drift apart. */
export interface RowPortBox extends Bounds {
  port: RowPort;
  side: 'left' | 'right';
  /** Position within its own side, top to bottom. */
  index: number;
}

const DEFAULT_PADDING = 8;
const DEFAULT_GAP = 4;
/** The space above and below a header row's text, inside its band. */
export const HEADER_PAD = 4;
/** The height a divider row takes; its rule runs through the middle. */
export const DIVIDER_HEIGHT = 4;

export { canvasMeasure } from './rowMeasure';

/** One run of text, by `measure`, else estimated from its length. */
function measureText(s: string, style: RowTextStyle | undefined, measure: MeasureRowText | undefined): ReturnType<MeasureRowText> {
  if (measure !== undefined) return measure(s, style ?? {});
  const height = style?.fontSize === undefined ? FALLBACK_LINE : Math.ceil(style.fontSize * 1.2);
  return { width: s.length * (style?.fontSize ?? FALLBACK_LINE) * 0.6 + trackingWidth(s, style), height };
}

/** A header's band, and where its text's line box sits in it: centered on the caps when the face's
 *  metrics are known, else on the line box. */
function headerBand(row: Extract<Row, { kind: 'header' }>, measure: MeasureRowText | undefined): { width: number } & HeaderBand {
  const t = measureText(row.text, row.style, measure);
  const pad = row.pad ?? HEADER_PAD;
  const height = t.height + pad * 2;
  return { width: t.width, height, text: { y: t.capCenter === undefined ? pad : height / 2 - t.capCenter, height: t.height } };
}

/** What each row is worth on its own, before padding and gaps. */
function measureRow(row: Row, measure: MeasureRowText | undefined): { width: number; height: number } {
  const text = (s: string, style?: RowTextStyle) => measureText(s, style, measure);

  switch (row.kind) {
    case 'header': {
      const { width, height } = headerBand(row, measure);
      return { width, height };
    }
    case 'label':
      return text(row.text, row.style);
    case 'field': {
      // Label and value sit on one line with a gap between them.
      const l = text(row.label, row.style);
      const v = text(row.value, row.style);
      const room = row.room === undefined ? 0 : text(row.room, row.style).width;
      return { width: l.width + DEFAULT_GAP * 2 + Math.max(v.width, room), height: Math.max(l.height, v.height) };
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
      return { width: row.width ?? 0, height: row.height };
    case 'divider':
      return { width: 0, height: DIVIDER_HEIGHT };
  }
}

/** Each row's height as {@link layoutBody} stacks it, top to bottom. */
export function rowHeights(spec: BodySpec, measure?: MeasureRowText): number[] {
  return spec.rows.map((row) => measureRow(row, measure).height);
}

/**
 * The smallest box `spec`'s rows fit in. A node's pose is maxed against this,
 * never set to it.
 */
export function measureBody(spec: BodySpec, measure?: MeasureRowText): BodyFloor {
  const padding = spec.padding ?? DEFAULT_PADDING;
  const gap = spec.gap ?? DEFAULT_GAP;
  const { header, rows } = splitHeader(spec.rows);
  let width = 0;
  let height = 0;
  for (const [i, row] of rows.entries()) {
    const m = measureRow(row, measure);
    width = Math.max(width, m.width);
    height += m.height + (i > 0 ? gap : 0);
  }
  // The rows fit the *content* box; the node's own box has to be whatever
  // contains that, or a diamond's label lands outside the diamond.
  const box = header !== undefined && rows.length === 0 ? { width: 0, height: 0 } : boxForContent(spec.outline, {
    width: width + padding * 2,
    height: height + padding * 2,
  });
  if (header === undefined) return { minWidth: box.width, minHeight: box.height };
  const band = measureRow(header, measure);
  return { minWidth: Math.max(box.width, band.width + padding * 2), minHeight: box.height + band.height };
}

/** `rows` with its header taken off the front. Throws on a header anywhere else. */
function splitHeader(rows: readonly Row[]): { header?: Extract<Row, { kind: 'header' }>; rows: readonly Row[] } {
  const late = rows.findIndex((r, i) => i > 0 && r.kind === 'header');
  if (late !== -1) throw new Error(`body: a 'header' row must be the first row, but row ${late} is one`);
  const first = rows[0];
  return first?.kind === 'header' ? { header: first, rows: rows.slice(1) } : { rows };
}

/**
 * The authored size, grown to fit the body. Never shrinks: a row removed
 * leaves the node the size the author last saw it at.
 */
export function sizeToBody<TPose extends Bounds>(pose: TPose, floor: BodyFloor): TPose {
  const width = Math.max(pose.width, floor.minWidth);
  const height = Math.max(pose.height, floor.minHeight);
  if (width === pose.width && height === pose.height) return pose;
  return { ...pose, width, height };
}

/** Where each row sits inside `bounds`, top to bottom. Rows keep their
 *  measured heights rather than sharing out the leftover; `verticalAlign`
 *  places the block of them within it. */
export function layoutBody(
  spec: BodySpec,
  bounds: Bounds,
  measure?: MeasureRowText,
): RowBox[] {
  return stackRows(spec, bounds, rowHeights(spec, measure), headerOf(spec, measure));
}

/** {@link layoutBody} from row heights already measured: `heights[i]` is row `i`'s, and `band`
 *  says where a header's text sits in its band. A header's box is its text's line box. */
export function stackRows(spec: BodySpec, bounds: Bounds, heights: readonly number[], band?: HeaderBand): RowBox[] {
  const padding = spec.padding ?? DEFAULT_PADDING;
  const gap = spec.gap ?? DEFAULT_GAP;
  const { header, rows } = splitHeader(spec.rows);
  const out: RowBox[] = [];
  let below = bounds;
  if (header !== undefined) {
    const tall = Math.min(heights[0] ?? 0, bounds.height);
    const pad = header.pad ?? HEADER_PAD;
    const text = band?.text ?? { y: pad, height: Math.max(tall - pad * 2, 0) };
    out.push({ row: header, index: 0, x: bounds.x + padding, y: bounds.y + text.y, width: Math.max(bounds.width - padding * 2, 0), height: text.height });
    below = { x: bounds.x, y: bounds.y + tall, width: bounds.width, height: bounds.height - tall };
  }
  const first = header === undefined ? 0 : 1;
  const own = heights.slice(first, first + rows.length);
  const inner = contentBox(spec.outline, below);
  const width = Math.max(inner.width - padding * 2, 0);
  const used = own.reduce((sum, h) => sum + h, 0) + gap * Math.max(own.length - 1, 0);
  const slack = Math.max(inner.height - padding * 2 - used, 0);
  const share = { top: 0, center: 0.5, bottom: 1 }[spec.verticalAlign ?? 'center'];
  let y = inner.y + padding + slack * share;
  for (const [i, row] of rows.entries()) {
    const index = i + first;
    const h = own[i]!;
    out.push(row.kind === 'divider'
      ? { row, index, x: inner.x + (row.inset ?? 0), y, width: Math.max(inner.width - 2 * (row.inset ?? 0), 0), height: h }
      : rowBox(row, index, inner.x + padding, width, y, h));
    y += h + gap;
  }
  return out;
}

/** `spec`'s header band, or `undefined` for a body without one. */
export function headerOf(spec: BodySpec, measure?: MeasureRowText): HeaderBand | undefined {
  const { header } = splitHeader(spec.rows);
  if (header === undefined) return undefined;
  const { height, text } = headerBand(header, measure);
  return { height, text };
}

/** A row other than a divider: the padded width, or a sized slot's width centered in it. */
function rowBox(row: Row, index: number, x: number, width: number, y: number, height: number): RowBox {
  const w = row.kind === 'slot' && row.width !== undefined ? Math.min(row.width, width) : width;
  return { row, index, x: x + (width - w) / 2, y, width: w, height };
}

/**
 * Where each of a `ports` row's ports goes inside `box`.
 *
 * Both sides are cut into the same number of slots — the longer side's count —
 * so the nth input faces the nth output whichever side has more. A label box
 * is as wide as its own text and pinned to its own edge of the row; an
 * unlabeled port gets a zero-width box there, which is still where it attaches.
 */
export function layoutRowPorts(
  row: Extract<Row, { kind: 'ports' }>,
  box: Bounds,
  measure?: MeasureRowText,
): RowPortBox[] {
  const width = (label: string | undefined): number =>
    label === undefined ? 0 : measureRow({ kind: 'label', text: label }, measure).width;
  const slots = Math.max(row.left?.length ?? 0, row.right?.length ?? 0, 1);
  const slotHeight = box.height / slots;
  const out: RowPortBox[] = [];
  const side = (ports: readonly RowPort[] | undefined, which: 'left' | 'right'): void => {
    for (const [index, port] of (ports ?? []).entries()) {
      const w = width(port.label);
      out.push({
        port,
        side: which,
        index,
        x: which === 'left' ? box.x : box.x + box.width - w,
        y: box.y + index * slotHeight,
        width: w,
        height: slotHeight,
      });
    }
  };
  side(row.left, 'left');
  side(row.right, 'right');
  return out;
}

/**
 * The `DiagramNode` trait a built body implies: perimeter ports for the
 * outline, plus one port per `ports`-row entry, anchored to that row's own
 * left or right edge.
 *
 * Anchors are normalized against `bounds`, so they survive the node being
 * resized.
 *
 * **A row port on a side takes that side's compass default with it.** Both sit
 * on the same edge, and a row near the vertical middle puts one exactly on top
 * of `w` or `e` — where the later region wins the hit and the other is
 * grabbable nowhere.
 */
export function bodyTrait(spec: BodySpec, bounds: Bounds, measure?: MeasureRowText): DiagramNode {
  const outline = spec.outline;
  const compass = withLabels(spec.ports ?? DEFAULT_PORTS, spec.portLabels);
  const band = headerOf(spec, measure);
  const header = band === undefined ? {} : { header: band };
  if (bounds.height <= 0) return { outline, ports: compass, ...header };

  const rowPorts: PortSpec[] = [];
  let hasLeft = false;
  let hasRight = false;
  for (const box of layoutBody(spec, bounds, measure)) {
    if (box.row.kind !== 'ports') continue;
    for (const pb of layoutRowPorts(box.row, box, measure)) {
      if (pb.side === 'left') hasLeft = true;
      else hasRight = true;
      const v = (pb.y + pb.height / 2 - bounds.y) / bounds.height;
      rowPorts.push(withType(
        { id: pb.port.id, at: { u: pb.side === 'left' ? 0 : 1, v } },
        pb.port.type,
      ));
    }
  }
  const kept = spec.ports !== undefined ? compass : compass.filter((p) =>
    !(p.id === 'w' && hasLeft) && !(p.id === 'e' && hasRight));
  const trait: DiagramNode = { outline, ports: [...kept, ...rowPorts], ...header };
  const margin = marginOf(bounds, portLabelsOf(trait, bounds, labelSize(measure)).map((l) => l.box));
  return margin === undefined ? trait : { ...trait, margin };
}

/** How big one port label is: measured as a `label` row with no style. */
export const labelSize = (measure: MeasureRowText | undefined) => (text: string) =>
  measureRow({ kind: 'label', text }, measure);

function withType(spec: PortSpec, type: string | undefined): PortSpec {
  return type === undefined ? spec : { ...spec, type };
}

/** The outline path for a built body at `bounds` — what paints it, and what a
 *  perimeter-hugging port will eventually be placed on. */
export function bodyOutline(spec: BodySpec, bounds: Bounds) {
  return outlinePath(spec.outline, bounds);
}
