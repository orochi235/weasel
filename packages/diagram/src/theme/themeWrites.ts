/**
 * What applying a theme writes: every color the theme owns, on every box,
 * text row, connector, label, and off-page tag, as new node `data`. A color named in the
 * owner's `ownStyle` is the author's, and stays.
 */
import { outlineOf, type NodeStyle, type OutlineKind } from '../dataTypes';
import { laneMiddle, regionAxisOf } from '../containers/laneStack';
import { deepEqual } from '@weasel-js/registry';
import { edgeStrokeOf } from '../edgeStroke';
import { roleEdgeStyle, roleStyle, themeLabelFamily, themeLabelFont } from './resolve';
import type { DiagramTheme, FontField, LineField, StyleField } from './types';

/** A scene node as {@link themeWrites} reads it. */
export interface ThemedNode {
  id: string;
  parent: string | null;
  data: unknown;
  /** Its box; a lane's orders it in its pool's stack. */
  pose?: unknown;
  dependsOn?: readonly string[] | 'children';
}

/** A scene as {@link themeWrites} reads it. */
export interface ThemedScene {
  get(id: never): ThemedNode | undefined;
  renderOrderNodes(): readonly ThemedNode[];
  childrenOf(id: never): readonly string[];
}

type Trait = Record<string, unknown> & {
  style?: string; ownStyle?: readonly StyleField[]; ownFont?: readonly FontField[]; ownLine?: readonly LineField[];
};
type Paint = { paint?: { color?: string } & Record<string, unknown> } & Record<string, unknown>;
type Data = Record<string, unknown> & { diagram?: Trait; fill?: Paint; stroke?: Paint; text?: unknown; style?: Record<string, unknown> };

/** A box's colors and outline, and the ones its author set, and whether the author set its text size.
 *  Its text rows take `style.text`. */
interface Look { style: NodeStyle; kind: OutlineKind; own: ReadonlySet<StyleField>; ownLine: ReadonlySet<LineField>; ownSize: boolean }

const traitOf = (data: unknown): Trait | null => {
  const d = (data as Data | null)?.diagram;
  return d !== null && typeof d === 'object' ? d : null;
};

const ownOf = (trait: Trait): ReadonlySet<StyleField> => new Set(trait.ownStyle ?? []);
const ownsSize = (trait: Trait): boolean => trait.ownFont?.includes('size') === true;
const ownLineOf = (trait: Trait): ReadonlySet<LineField> => new Set(trait.ownLine ?? []);

/** A container's role, as the containers trait (`data.diagram.container`) names it. */
function containerRole(trait: Trait): string | null {
  const c = trait.container as { role?: unknown } | undefined;
  return c !== null && typeof c === 'object' && typeof c.role === 'string' ? c.role : null;
}

/** A lane's place in its pool's stack: by its middle along the pool's axis, as `laneStackLayout` orders them. */
function laneIndex(scene: ThemedScene, node: ThemedNode): number {
  if (node.parent === null) return 0;
  const pool = scene.get(node.parent as never);
  const axis = (pool === undefined ? undefined : regionAxisOf(pool)) ?? 'y';
  const mid = (id: string) => laneMiddle(axis, (scene.get(id as never)?.pose ?? {}) as Parameters<typeof laneMiddle>[1]);
  const lanes = scene.childrenOf(node.parent as never).filter((id) => {
    const t = traitOf(scene.get(id as never)?.data);
    return t !== null && containerRole(t) === 'lane';
  }).sort((a, b) => mid(a) - mid(b));
  return Math.max(0, lanes.indexOf(node.id));
}

/** The look a box takes from `theme`: a body its role's, a cluster or container the theme's
 *  container, a pool its lane header, a lane the lane bodies in turn. `null` for no box. */
function boxLook(scene: ThemedScene, node: ThemedNode, theme: DiagramTheme): Look | null {
  const trait = traitOf(node.data);
  if (trait === null || 'from' in trait || 'label' in trait || 'anchor' in trait || 'mark' in trait) return null;
  const marks = { own: ownOf(trait), ownLine: ownLineOf(trait), ownSize: ownsSize(trait) };
  const role = containerRole(trait);
  if (role === 'pool') return { style: theme.lane.header, kind: 'region', ...marks };
  if (role === 'lane') {
    const bodies = theme.lane.bodies;
    return { style: bodies[laneIndex(scene, node) % bodies.length] ?? theme.container, kind: 'lane', ...marks };
  }
  if (role !== null) return { style: theme.container, kind: 'region', ...marks };
  if ('cluster' in trait) return { style: theme.container, kind: 'cluster', ...marks };
  return { style: roleStyle(theme, trait.style), kind: 'body', ...marks };
}

const recolored = (paint: Paint | undefined, color: string): Paint | undefined =>
  paint?.paint?.color === color ? undefined : { ...paint, paint: { ...paint?.paint, color } };

const sameDash = (a: unknown, b: unknown): boolean =>
  (Array.isArray(a) && a.length > 0 ? a.join() : '') === (Array.isArray(b) && b.length > 0 ? b.join() : '');

/** `stroke` in `color` (unless `undefined`) and in `line`'s width and dash where the author has not
 *  set them, or `undefined` when nothing changes. */
function restroked(stroke: Paint, color: string | undefined, line: { width: unknown; dash?: readonly number[] }, own: ReadonlySet<LineField>): Paint | undefined {
  const next: Paint = { ...stroke };
  if (color !== undefined) next.paint = { ...stroke.paint, color };
  if (!own.has('width')) next.width = line.width;
  if (!own.has('dash')) {
    if (line.dash !== undefined && line.dash.length > 0) next.dash = [...line.dash];
    else delete next.dash;
  }
  const same = next.paint?.color === stroke.paint?.color && deepEqual(next.width, stroke.width) && sameDash(next.dash, stroke.dash);
  return same ? undefined : next;
}

/** `data` with its fill, stroke and outline as `look` draws them where the author has not set them,
 *  or `null` when nothing changes. */
function paintBox(data: Data, look: Look): Data | null {
  const fill = look.own.has('fill') ? undefined : recolored(data.fill, look.style.fill);
  const stroke = data.stroke === undefined ? undefined
    : restroked(data.stroke, look.own.has('stroke') ? undefined : look.style.stroke, outlineOf(look.style, look.kind), look.ownLine);
  const band = paintBand(data, look);
  if (fill === undefined && stroke === undefined && band === undefined) return null;
  const { headerFill, ...rest } = data;
  const nextBand = band === undefined ? headerFill : band;
  return { ...rest, ...(fill ? { fill } : {}), ...(stroke ? { stroke } : {}), ...(nextBand != null ? { headerFill: nextBand } : {}) };
}

const isHeaderRow = (data: Data, owner: ThemedNode): boolean =>
  data.bodyRow === 0 && traitOf(owner.data)?.header !== undefined;

/** The color a box's text row takes, or `undefined` to leave it: a header row's is drawn against
 *  its band, in the box's fill, the author's or the theme's, unless the theme names one; a `text` color never reaches it. */
function rowColor(data: Data, owner: ThemedNode, look: Look): string | undefined {
  if (!isHeaderRow(data, owner)) return look.own.has('text') ? undefined : look.style.text;
  if (look.style.headerText !== undefined) return look.style.headerText;
  if (!look.own.has('fill')) return look.style.fill;
  const own = (owner.data as Data).fill?.paint?.color;
  return typeof own === 'string' ? own : undefined;
}

/** `data`'s header band in `look`'s, `null` to drop a band color so the band follows the stroke,
 *  or `undefined` when nothing changes. */
function paintBand(data: Data, look: Look): Paint | null | undefined {
  const want = look.style.header;
  if (want === undefined || traitOf(data)?.header === undefined) return data.headerFill === undefined ? undefined : null;
  return recolored(data.headerFill as Paint | undefined, want);
}

/** The key on a text row's `data` holding the size a theme step took it to below 1, where it is
 *  drawn at 1, so the step back lands where it started. */
export const UNCLAMPED_FONT_SIZE = 'unclampedFontSize';

/** `data`'s text recolored to `color` (unless `undefined`), set in `family`, and its size moved by
 *  `step`, or `null` when nothing changes. A size the step takes below 1 is drawn at 1 and kept as
 *  {@link UNCLAMPED_FONT_SIZE}, and the next step moves from it. */
function paintText(data: Data, color: string | undefined, family: string, step: number): Data | null {
  const fill = color === undefined ? undefined : recolored(data.fill, color);
  const size = data.style?.fontSize;
  const owed = data[UNCLAMPED_FONT_SIZE];
  const want = step !== 0 && typeof size === 'number' ? (typeof owed === 'number' ? owed : size) + step : undefined;
  const resized = want !== undefined ? { fontSize: Math.max(1, want) } : {};
  const face = data.style !== undefined && (data.style.fontFamily !== family || 'fontSize' in resized)
    ? { ...data.style, fontFamily: family, ...resized } : undefined;
  if (fill === undefined && face === undefined) return null;
  const { [UNCLAMPED_FONT_SIZE]: _, ...rest } = data;
  const keep = want === undefined ? (owed !== undefined ? { [UNCLAMPED_FONT_SIZE]: owed } : {}) : want < 1 ? { [UNCLAMPED_FONT_SIZE]: want } : {};
  return { ...rest, ...keep, ...(fill ? { fill } : {}), ...(face ? { style: face } : {}) };
}

/** An off-page tag's `data` in `theme`'s label color and face, on its page color, its size moved
 *  by `step` as an edge label's is, or `null`. */
function paintTag(data: Data, theme: DiagramTheme, step: number): Data | null {
  const text = paintText(data, theme.label.fill, themeLabelFamily(theme), step);
  const background = recolored(data.background as Paint | undefined, theme.page);
  if (text === null && background === undefined) return null;
  return { ...(text ?? data), ...(background ? { background } : {}) };
}

/** The width and dash `theme` draws a shape's outline or a connector's line in, for `role`. */
export function themeLine(theme: DiagramTheme, kind: 'shape' | 'connector', role?: string): { width: unknown; dash?: readonly number[] } {
  if (kind === 'shape') return outlineOf(roleStyle(theme, role), 'body');
  const { width, dash } = edgeStrokeOf(roleEdgeStyle(theme, role));
  return { width, ...(dash ? { dash } : {}) };
}

/** A connector's own colors and line, and its label's color, under `theme`. */
function edgeLook(trait: Trait, theme: DiagramTheme) {
  const style = roleEdgeStyle(theme, trait.style);
  return {
    stroke: style.stroke, label: style.label ?? style.stroke, line: themeLine(theme, 'connector', trait.style),
    own: ownOf(trait), ownLine: ownLineOf(trait), ownSize: ownsSize(trait),
  };
}

const ownerOf = (node: ThemedNode): string | null =>
  Array.isArray(node.dependsOn) && node.dependsOn.length === 1 ? node.dependsOn[0]! : node.parent;

/**
 * The new `data` for every node `theme` recolors: shapes, their text rows,
 * clusters and containers and their titles, connectors and their labels. Given
 * `ids`, only those boxes and connectors, and the text that belongs to them.
 * Given `from`, the theme the scene was in, text moves by the step between the
 * two themes' sizes, except where its owner's author set the size. A node
 * already as the theme draws it is left out.
 */
export function themeWrites(scene: ThemedScene, theme: DiagramTheme, ids?: ReadonlySet<string>, from?: DiagramTheme): Map<string, unknown> {
  const out = new Map<string, unknown>();
  const step = from === undefined ? 0 : theme.font.size - from.font.size;
  const labelStep = from === undefined ? 0 : themeLabelFont(theme).fontSize - themeLabelFont(from).fontSize;
  const looks = new Map<string, Look | null>();
  const lookOf = (id: string): Look | null => {
    if (!looks.has(id)) {
      const node = scene.get(id as never);
      looks.set(id, node === undefined ? null : boxLook(scene, node, theme));
    }
    return looks.get(id)!;
  };
  const write = (id: string, next: Data | null) => { if (next !== null) out.set(id, next); };
  for (const node of scene.renderOrderNodes()) {
    const data = node.data as Data | null;
    if (data === null || typeof data !== 'object') continue;
    const trait = traitOf(data);
    // A sequence draws its parts from its data and the theme, and `applyDiagramTheme` draws them again.
    if (trait !== null && ('seq' in trait || 'sequence' in trait)) continue;
    if (trait !== null && 'from' in trait && 'to' in trait) {
      if (ids !== undefined && !ids.has(node.id)) continue;
      const look = edgeLook(trait, theme);
      const stroke = data.stroke === undefined ? undefined
        : restroked(data.stroke, look.own.has('stroke') ? undefined : look.stroke, look.line, look.ownLine);
      if (stroke !== undefined) out.set(node.id, { ...data, stroke });
      continue;
    }
    if (trait !== null && 'label' in trait) {
      const edgeId = ownerOf(node);
      const edgeTrait = edgeId === null ? null : traitOf(scene.get(edgeId as never)?.data);
      if (edgeId === null || edgeTrait === null || (ids !== undefined && !ids.has(edgeId))) continue;
      const look = edgeLook(edgeTrait, theme);
      write(node.id, paintText(data, look.own.has('text') ? undefined : look.label, themeLabelFamily(theme), look.ownSize ? 0 : labelStep));
      continue;
    }
    if (trait !== null && 'offPageTag' in trait) {
      const edgeId = ownerOf(node);
      if (ids === undefined || (edgeId !== null && ids.has(edgeId))) write(node.id, paintTag(data, theme, labelStep));
      continue;
    }
    if (trait !== null && 'mark' in trait) continue;
    const look = lookOf(node.id);
    if (look !== null) {
      if (ids === undefined || ids.has(node.id)) write(node.id, paintBox(data, look));
      continue;
    }
    // A text row, a port label, or a cluster's title: colored as the box it belongs to.
    const owner = ownerOf(node);
    const ownerLook = owner === null ? null : lookOf(owner);
    if (ownerLook === null || typeof data.text !== 'string' || (ids !== undefined && !ids.has(owner!))) continue;
    write(node.id, paintText(data, rowColor(data, scene.get(owner as never)!, ownerLook), theme.font.family, ownerLook.ownSize ? 0 : step));
  }
  return out;
}
