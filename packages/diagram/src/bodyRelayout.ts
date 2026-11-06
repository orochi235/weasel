/**
 * Laying a built body out again once its text changes size. A body whose
 * rows are all text, a header, or dividers records how it stacks them (`DiagramNode.body`),
 * and each text row records its place (`bodyRow`), so the rows can be read
 * back from the scene and handed to the same layout `buildBody` used.
 */
import {
  headerOf, layoutBody, measureBody, rowHeights, sizeToBody, stackRows, type BodySpec, type MeasureRowText, type Row, type RowBox, type RowTextStyle,
} from './body';
import type { Bounds } from './outline';
import type { BodyDivider, BodyLayout, DiagramNode } from './types';

/** The `body` record a body built from `spec` carries, or `undefined` for one that cannot be laid
 *  out again from its text: one with a `ports` or `slot` row, or with port labels drawn outside it. */
export function bodyLayoutOf(spec: BodySpec, trait: DiagramNode, measure?: MeasureRowText): { body: BodyLayout } | Record<string, never> {
  if (trait.margin !== undefined || !spec.rows.every((r) => r.kind === 'header' || r.kind === 'label' || r.kind === 'field' || r.kind === 'divider')) return {};
  const dividers = dividersOf(spec.rows);
  return {
    body: {
      padding: spec.padding ?? 8, gap: spec.gap ?? 4, verticalAlign: spec.verticalAlign ?? 'center', rows: spec.rows.length,
      heights: rowHeights(spec, measure), ...(dividers.length > 0 ? { dividers } : {}),
    },
  };
}

const dividerRow = (d: BodyDivider): Row => (d.inset === undefined ? { kind: 'divider' } : { kind: 'divider', inset: d.inset });

function dividersOf(rows: readonly Row[]): BodyDivider[] {
  return rows.flatMap((r, index) => (r.kind !== 'divider' ? [] : [r.inset === undefined ? { index } : { index, inset: r.inset }]));
}

/** `trait`'s rows with no text to measure: each divider as itself, a header as an empty one, and
 *  every other row as a slot. Null for a body saved without its heights. */
function recordedRows(trait: DiagramNode): Row[] | null {
  const layout = trait.body;
  if (layout?.heights === undefined) return null;
  const dividers = new Map((layout.dividers ?? []).map((d) => [d.index, d]));
  return layout.heights.map((height, i): Row => {
    if (i === 0 && trait.header !== undefined) return { kind: 'header', text: '' };
    const d = dividers.get(i);
    return d === undefined ? { kind: 'slot', height } : dividerRow(d);
  });
}

/** Where a built body's rows go when it is at `box`, from the row heights its trait records. Null
 *  for a body that records none. */
export function recordedLayout(trait: DiagramNode, box: Bounds): RowBox[] | null {
  const layout = trait.body;
  const rows = recordedRows(trait);
  if (layout === undefined || rows === null || trait.outline === undefined) return null;
  const spec = { outline: trait.outline, rows, padding: layout.padding, gap: layout.gap, verticalAlign: layout.verticalAlign };
  return stackRows(spec, box, layout.heights!, trait.header);
}

type Box = { x: number; y: number; width: number; height: number };
type TextData = {
  text?: unknown; bodyRow?: unknown;
  style?: { fontSize?: number; fontFamily?: string; fontWeight?: number; fontStyle?: string; letterSpacing?: number };
};

/** A scene as {@link relayoutBodies} reads and writes it. */
export interface RelayoutScene {
  get(id: never): { pose: unknown; data: unknown } | undefined;
  childrenOf(id: never): readonly string[];
  setPose(id: never, pose: never): void;
  update(id: never, patch: never): void;
}

const rowStyle = (s: TextData['style']): RowTextStyle => ({
  ...(s?.fontSize !== undefined ? { fontSize: s.fontSize } : {}),
  ...(s?.fontFamily !== undefined ? { fontFamily: s.fontFamily } : {}),
  ...(s?.fontWeight === 700 ? { bold: true } : s?.fontWeight !== undefined && s.fontWeight !== 400 ? { weight: s.fontWeight } : {}),
  ...(s?.fontStyle === 'italic' ? { italic: true } : {}),
  ...(s?.letterSpacing ? { tracking: s.letterSpacing / (s.fontSize ?? 16) } : {}),
});

const same = (a: Box, b: Box) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/**
 * Lays each body among `ids` out again from its text rows as they are now:
 * the body grows to what its rows need, never shrinks, and its rows are
 * stacked again inside it. Anything that is not a body carrying a `body`
 * record is left alone. Call inside the batch that changed the text, so it is
 * the same undo entry.
 */
export function relayoutBodies(scene: RelayoutScene, ids: Iterable<string>, measure?: MeasureRowText): void {
  for (const id of new Set(ids)) {
    const node = scene.get(id as never);
    const trait = (node?.data as { diagram?: DiagramNode } | undefined)?.diagram;
    if (node === undefined || trait?.body === undefined || trait.outline === undefined) continue;
    const layout = trait.body;
    const rowNodes = new Map<number, string>();
    for (const child of scene.childrenOf(id as never)) {
      const index = (scene.get(child as never)?.data as TextData | undefined)?.bodyRow;
      if (typeof index === 'number') rowNodes.set(index, child);
    }
    const dividers = new Map((layout.dividers ?? []).map((d) => [d.index, d]));
    const rows: Row[] = Array.from({ length: layout.rows }, (_, i): Row => {
      const divider = dividers.get(i);
      if (divider !== undefined) return dividerRow(divider);
      const data = scene.get(rowNodes.get(i) as never)?.data as TextData | undefined;
      const text = typeof data?.text === 'string' ? data.text : '';
      const style = rowStyle(data?.style);
      // The band records its text's line box, so the room left either side of it is the header's pad.
      const band = i === 0 ? trait.header : undefined;
      return band === undefined ? { kind: 'label', text, style } : { kind: 'header', text, style, pad: (band.height - band.text.height) / 2 };
    });
    const spec: BodySpec = { outline: trait.outline, rows, padding: layout.padding, gap: layout.gap, verticalAlign: layout.verticalAlign };
    const heights = rowHeights(spec, measure);
    const band = headerOf(spec, measure);
    const moved = band !== undefined && (trait.header?.height !== band.height || trait.header.text.y !== band.text.y || trait.header.text.height !== band.text.height);
    if (layout.heights === undefined || moved || heights.some((h, i) => h !== layout.heights![i])) {
      const data = node.data as { diagram: DiagramNode };
      scene.update(id as never, { data: { ...data, diagram: { ...trait, body: { ...layout, heights }, ...(band ? { header: band } : {}) } } } as never);
    }
    const pose = node.pose as Box;
    const grown = sizeToBody(pose, measureBody(spec, measure));
    if (grown !== pose) scene.setPose(id as never, grown as never);
    // Rows are stored in the body's own frame.
    for (const box of layoutBody(spec, { x: 0, y: 0, width: grown.width, height: grown.height }, measure)) {
      const child = rowNodes.get(box.index);
      const at = child === undefined ? undefined : scene.get(child as never)?.pose as Box | undefined;
      if (at === undefined) continue;
      const next = { ...at, x: box.x, y: box.y, width: box.width, height: box.height };
      if (!same(at, next)) scene.setPose(child as never, next as never);
    }
  }
}
