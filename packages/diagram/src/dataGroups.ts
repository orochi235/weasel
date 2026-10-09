/**
 * `diagramScene`'s groups: which nodes each one holds, and the box and label
 * it draws around them.
 */
import type { GroupInset } from './cluster';
import type { DataGroup, DiagramSceneData, DiagramSpec, NodeStyle } from './fromData';
import { ANCHOR_DERIVE_POSE, GROUP_DERIVE_POSE, type DiagramAnchor } from './group';

/** A group with its members settled and its inset worked out. */
export interface ResolvedGroup {
  group: DataGroup;
  members: readonly string[];
  inset: GroupInset;
  pad: number;
  title: { width: number; height: number } | null;
}

/**
 * Settle each group's members: node ids only, and a node a later group also
 * names stays in the first. A group left with none is dropped. Throws on a
 * group id already in `ids`, and adds each group's id to it.
 */
export function resolveGroups(
  groups: readonly DataGroup[],
  ids: Set<string>,
  nodeIds: ReadonlySet<string>,
  opts: { padding: number; title: (text: string) => { width: number; height: number } },
): ResolvedGroup[] {
  const claimed = new Set<string>();
  const out: ResolvedGroup[] = [];
  for (const group of groups) {
    if (ids.has(group.id)) throw new Error(`diagramScene: group id "${group.id}" is already a node or group id`);
    ids.add(group.id);
    const members = group.members.filter((m) => nodeIds.has(m) && !claimed.has(m));
    for (const m of members) claimed.add(m);
    if (members.length === 0) continue;
    const pad = group.padding ?? opts.padding;
    const title = group.label ? opts.title(group.label) : null;
    // The label sits in the top inset, half a pad above the members.
    const inset = { top: pad + (title ? title.height + pad / 2 : 0), right: pad, bottom: pad, left: pad };
    out.push({ group, members, inset, pad, title });
  }
  return out;
}

/** Each group's box, and its label when it has one, around where its members were placed. */
export function groupSpecs(
  groups: readonly ResolvedGroup[],
  placedAt: ReadonlyMap<string, { x: number; y: number; width: number; height: number }>,
  styleOf: (group: DataGroup) => { style: NodeStyle; text: NonNullable<DiagramSceneData['style']> },
): DiagramSpec[] {
  const specs: DiagramSpec[] = [];
  for (const g of groups) {
    const { style, text } = styleOf(g.group);
    const rs = g.members.map((m) => placedAt.get(m)!);
    const x = Math.min(...rs.map((r) => r.x)) - g.inset.left;
    const y = Math.min(...rs.map((r) => r.y)) - g.inset.top;
    specs.push({
      id: g.group.id as never,
      kind: 'leaf',
      layer: 'main',
      pickable: false,
      pose: {
        x,
        y,
        width: Math.max(...rs.map((r) => r.x + r.width)) + g.inset.right - x,
        height: Math.max(...rs.map((r) => r.y + r.height)) + g.inset.bottom - y,
      },
      data: {
        diagram: { outline: 'rect', group: { inset: g.inset } },
        fill: { color: style.fill },
        stroke: {
          paint: { color: style.stroke },
          width: style.strokeWidth ?? 1,
          ...(style.dash ? { dash: style.dash } : {}),
        },
      },
      dependsOn: g.members as never[],
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
      data: { diagram: { anchor }, text: g.group.label, style: text, fill: { color: style.text } },
      dependsOn: [g.group.id as never],
      derivePose: ANCHOR_DERIVE_POSE as never,
    });
  }
  return specs;
}
