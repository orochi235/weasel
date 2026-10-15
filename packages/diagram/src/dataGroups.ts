/**
 * `diagramScene`'s groups: which nodes each one holds, and the box and label
 * it draws around them.
 */
import type { GroupInset } from './cluster';
import type { DataGroup, DiagramSceneData, DiagramSpec, NodeStyle } from './fromData';
import { ANCHOR_DERIVE_POSE, GROUP_DERIVE_POSE, boxAround, type DiagramAnchor } from './group';
import { nestGroups } from './groupTree';

/** A group with its members settled and its inset worked out. */
export interface ResolvedGroup {
  group: DataGroup;
  /** The nodes and groups directly inside, which the box derives from. */
  direct: readonly string[];
  /** Every node inside, through any nested group. */
  members: readonly string[];
  /** The group this one is directly inside. */
  parent?: string;
  inset: GroupInset;
  pad: number;
  title: { width: number; height: number } | null;
  /** Room for the title across the box, when there is one. */
  minWidth?: number;
}

/**
 * Settle what each group holds (see `nestGroups`), outer groups ahead of the
 * groups inside them. A group left with no node inside it is dropped. Throws
 * on a group id already in `ids`, and adds each group's id to it.
 */
export function resolveGroups(
  groups: readonly DataGroup[],
  ids: Set<string>,
  nodeIds: ReadonlySet<string>,
  opts: { padding: number; title: (text: string) => { width: number; height: number } },
): ResolvedGroup[] {
  for (const group of groups) {
    if (ids.has(group.id)) throw new Error(`diagramScene: group id "${group.id}" is already a node or group id`);
    ids.add(group.id);
  }
  const declared = new Map(groups.map((g) => [g.id, g]));
  const nested = nestGroups(groups, (id) => nodeIds.has(id));
  const depthOf = new Map<string, number>();
  const byId = new Map(nested.map((g) => [g.id, g]));
  const depth = (id: string): number => {
    const parent = byId.get(id)!.parent;
    let d = depthOf.get(id);
    if (d === undefined) depthOf.set(id, (d = parent === undefined ? 0 : depth(parent) + 1));
    return d;
  };
  // Stable, so groups at one depth keep the order they were declared in.
  return nested.map((g, i) => ({ g, i })).sort((a, b) => depth(a.g.id) - depth(b.g.id) || a.i - b.i).map(({ g }) => {
    const group = declared.get(g.id)!;
    const pad = group.padding ?? opts.padding;
    const title = group.label ? opts.title(group.label) : null;
    // The label sits in the top inset, half a pad above what the box holds.
    const inset = { top: pad + (title ? title.height + pad / 2 : 0), right: pad, bottom: pad, left: pad };
    return {
      group, direct: g.direct, members: g.members, inset, pad, title,
      ...(title ? { minWidth: title.width + 2 * pad } : {}),
      ...(g.parent !== undefined ? { parent: g.parent } : {}),
    };
  });
}

type Rect = { x: number; y: number; width: number; height: number };

/** Each group's box around where its members were placed. */
export function groupBoxes(
  groups: readonly ResolvedGroup[],
  placedAt: ReadonlyMap<string, Rect>,
): Map<string, Rect> {
  const byId = new Map(groups.map((g) => [g.group.id, g]));
  const boxes = new Map<string, Rect>();
  const boxOf = (id: string): Rect => {
    const known = boxes.get(id);
    if (known !== undefined) return known;
    const g = byId.get(id)!;
    const rs = g.direct.map((m) => (byId.has(m) ? boxOf(m) : placedAt.get(m)!));
    const x = Math.min(...rs.map((r) => r.x));
    const y = Math.min(...rs.map((r) => r.y));
    const box = boxAround({
      x,
      y,
      width: Math.max(...rs.map((r) => r.x + r.width)) - x,
      height: Math.max(...rs.map((r) => r.y + r.height)) - y,
    }, g);
    boxes.set(id, box);
    return box;
  };
  for (const g of groups) boxOf(g.group.id);
  return boxes;
}

/**
 * Each group's box, and its label when it has one, around where its members
 * were placed. In the order given, so an outer box paints behind the boxes
 * inside it.
 */
export function groupSpecs(
  groups: readonly ResolvedGroup[],
  placedAt: ReadonlyMap<string, Rect>,
  styleOf: (group: DataGroup) => { style: NodeStyle; text: NonNullable<DiagramSceneData['style']> },
): DiagramSpec[] {
  const boxes = groupBoxes(groups, placedAt);
  const specs: DiagramSpec[] = [];
  for (const g of groups) {
    const { style, text } = styleOf(g.group);
    const { x, y, width, height } = boxes.get(g.group.id)!;
    specs.push({
      id: g.group.id as never,
      kind: 'leaf',
      layer: 'main',
      pose: { x, y, width, height },
      data: {
        diagram: { outline: 'rect', group: { inset: g.inset, ...(g.minWidth !== undefined ? { minWidth: g.minWidth } : {}) } },
        fill: { paint: { color: style.fill } },
        stroke: {
          paint: { color: style.stroke },
          width: style.strokeWidth ?? 1,
          ...(style.dash ? { dash: style.dash } : {}),
        },
      },
      dependsOn: g.direct as never[],
      derivePose: GROUP_DERIVE_POSE as never,
    });
    if (g.title === null || !g.group.label) continue;
    const anchor: DiagramAnchor = { at: { u: 0, v: 0 }, offset: { x: g.pad, y: g.pad } };
    specs.push({
      id: `${g.group.id}/label` as never,
      kind: 'leaf',
      layer: 'main',
      pickable: false,
      pose: { x: x + g.pad, y: y + g.pad, width: g.title.width, height: g.title.height },
      data: { diagram: { anchor }, text: g.group.label, style: text, fill: { paint: { color: style.text } } },
      dependsOn: [g.group.id as never],
      derivePose: ANCHOR_DERIVE_POSE as never,
    });
  }
  return specs;
}
