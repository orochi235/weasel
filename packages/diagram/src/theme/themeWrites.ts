/**
 * What applying a theme writes: every color the theme owns, on every box,
 * text row, connector, label, and off-page tag, as new node `data`. A color named in the
 * owner's `ownStyle` is the author's, and stays.
 */
import type { NodeStyle } from '../fromData';
import { roleEdgeStyle, roleStyle, themeLabelFamily, themeLabelFont } from './resolve';
import type { DiagramTheme, FontField, StyleField } from './types';

/** A scene node as {@link themeWrites} reads it. */
export interface ThemedNode {
  id: string;
  parent: string | null;
  data: unknown;
  dependsOn?: readonly string[] | 'children';
}

/** A scene as {@link themeWrites} reads it. */
export interface ThemedScene {
  get(id: never): ThemedNode | undefined;
  renderOrderNodes(): readonly ThemedNode[];
  childrenOf(id: never): readonly string[];
}

type Trait = Record<string, unknown> & { style?: string; ownStyle?: readonly StyleField[]; ownFont?: readonly FontField[] };
type Paint = { paint?: { color?: string } & Record<string, unknown> } & Record<string, unknown>;
type Data = Record<string, unknown> & { diagram?: Trait; fill?: Paint; stroke?: Paint; text?: unknown; style?: Record<string, unknown> };

/** A box's colors, and the ones its author set, and whether the author set its text size. Its text
 *  rows take `style.text`. */
interface Look { style: NodeStyle; own: ReadonlySet<StyleField>; ownSize: boolean }

const traitOf = (data: unknown): Trait | null => {
  const d = (data as Data | null)?.diagram;
  return d !== null && typeof d === 'object' ? d : null;
};

const ownOf = (trait: Trait): ReadonlySet<StyleField> => new Set(trait.ownStyle ?? []);
const ownsSize = (trait: Trait): boolean => trait.ownFont?.includes('size') === true;

/** A container's role, as the containers trait (`data.diagram.container`) names it. */
function containerRole(trait: Trait): string | null {
  const c = trait.container as { role?: unknown } | undefined;
  return c !== null && typeof c === 'object' && typeof c.role === 'string' ? c.role : null;
}

function laneIndex(scene: ThemedScene, node: ThemedNode): number {
  if (node.parent === null) return 0;
  const lanes = scene.childrenOf(node.parent as never).filter((id) => {
    const t = traitOf(scene.get(id as never)?.data);
    return t !== null && containerRole(t) === 'lane';
  });
  return Math.max(0, lanes.indexOf(node.id));
}

/** The look a box takes from `theme`: a body its role's, a group or container the theme's
 *  container, a pool its lane header, a lane the lane bodies in turn. `null` for no box. */
function boxLook(scene: ThemedScene, node: ThemedNode, theme: DiagramTheme): Look | null {
  const trait = traitOf(node.data);
  if (trait === null || 'from' in trait || 'label' in trait || 'anchor' in trait || 'mark' in trait) return null;
  const own = ownOf(trait);
  const ownSize = ownsSize(trait);
  const role = containerRole(trait);
  if (role === 'pool') return { style: theme.lane.header, own, ownSize };
  if (role === 'lane') {
    const bodies = theme.lane.bodies;
    return { style: bodies[laneIndex(scene, node) % bodies.length] ?? theme.container, own, ownSize };
  }
  if (role !== null || 'group' in trait) return { style: theme.container, own, ownSize };
  return { style: roleStyle(theme, trait.style), own, ownSize };
}

const recolored = (paint: Paint | undefined, color: string): Paint | undefined =>
  paint?.paint?.color === color ? undefined : { ...paint, paint: { ...paint?.paint, color } };

/** `data` with its fill and stroke recolored where the author has not set them, or `null` when
 *  nothing changes. */
function paintBox(data: Data, look: Look): Data | null {
  const fill = look.own.has('fill') ? undefined : recolored(data.fill, look.style.fill);
  const stroke = look.own.has('stroke') || data.stroke === undefined ? undefined : recolored(data.stroke, look.style.stroke);
  if (fill === undefined && stroke === undefined) return null;
  return { ...data, ...(fill ? { fill } : {}), ...(stroke ? { stroke } : {}) };
}

/** `data`'s text recolored to `color` (unless `undefined`), set in `family`, and its size moved by
 *  `step`, or `null` when nothing changes. */
function paintText(data: Data, color: string | undefined, family: string, step: number): Data | null {
  const fill = color === undefined ? undefined : recolored(data.fill, color);
  const size = data.style?.fontSize;
  const resized = step !== 0 && typeof size === 'number' ? { fontSize: Math.max(1, size + step) } : {};
  const face = data.style !== undefined && (data.style.fontFamily !== family || 'fontSize' in resized)
    ? { ...data.style, fontFamily: family, ...resized } : undefined;
  if (fill === undefined && face === undefined) return null;
  return { ...data, ...(fill ? { fill } : {}), ...(face ? { style: face } : {}) };
}

/** An off-page tag's `data` in `theme`'s label color and face, on its page color, its size moved
 *  by `step` as an edge label's is, or `null`. */
function paintTag(data: Data, theme: DiagramTheme, step: number): Data | null {
  const text = paintText(data, theme.label.fill, themeLabelFamily(theme), step);
  const background = recolored(data.background as Paint | undefined, theme.page);
  if (text === null && background === undefined) return null;
  return { ...(text ?? data), ...(background ? { background } : {}) };
}

/** A connector's own colors, and its label's, under `theme`. */
function edgeLook(trait: Trait, theme: DiagramTheme): { stroke: string; label: string; own: ReadonlySet<StyleField>; ownSize: boolean } {
  const style = roleEdgeStyle(theme, trait.style);
  return { stroke: style.stroke, label: style.label ?? style.stroke, own: ownOf(trait), ownSize: ownsSize(trait) };
}

const ownerOf = (node: ThemedNode): string | null =>
  Array.isArray(node.dependsOn) && node.dependsOn.length === 1 ? node.dependsOn[0]! : node.parent;

/**
 * The new `data` for every node `theme` recolors: shapes, their text rows,
 * groups and containers and their titles, connectors and their labels. Given
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
      const stroke = look.own.has('stroke') || data.stroke === undefined ? undefined : recolored(data.stroke, look.stroke);
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
    // A text row, a port label, or a group's title: colored as the box it belongs to.
    const owner = ownerOf(node);
    const ownerLook = owner === null ? null : lookOf(owner);
    if (ownerLook === null || typeof data.text !== 'string' || (ids !== undefined && !ids.has(owner!))) continue;
    write(node.id, paintText(data, ownerLook.own.has('text') ? undefined : ownerLook.style.text, theme.font.family, ownerLook.ownSize ? 0 : step));
  }
  return out;
}
