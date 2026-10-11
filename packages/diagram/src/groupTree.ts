/**
 * Which group holds what, settled once for both readers of groups: the scene
 * graph a layout runs over, and the data a diagram is built from.
 *
 * A group names nodes and other groups. A node belongs to the first group that
 * names it and a group to the first group that names it, in source order; a
 * membership that would make a group its own ancestor is ignored, and so is an
 * id that is neither. A group with no node anywhere inside it is dropped.
 */

/** A group as declared: its id and the ids it names. */
export interface DeclaredGroup {
  id: string;
  members: readonly string[];
}

/** A group with its place in the tree settled. */
export interface NestedGroup {
  id: string;
  /** The nodes and groups directly inside, in the order they were named. */
  direct: string[];
  /** Every node inside, through any nested group, in that same order. */
  members: string[];
  /** The group this one is directly inside. */
  parent?: string;
}

export function nestGroups(
  declared: readonly DeclaredGroup[],
  isNode: (id: string) => boolean,
): NestedGroup[] {
  const groupIds = new Set(declared.map((g) => g.id));
  const parentOf = new Map<string, string>();
  const claimedNodes = new Set<string>();
  const direct = new Map<string, string[]>();

  const isAncestorOrSelf = (candidate: string, of: string): boolean => {
    for (let at: string | undefined = of; at !== undefined; at = parentOf.get(at)) {
      if (at === candidate) return true;
    }
    return false;
  };

  for (const group of declared) {
    const own: string[] = [];
    for (const id of group.members) {
      if (isNode(id)) {
        if (claimedNodes.has(id)) continue;
        claimedNodes.add(id);
        own.push(id);
      } else if (groupIds.has(id) && !parentOf.has(id) && !isAncestorOrSelf(id, group.id)) {
        parentOf.set(id, group.id);
        own.push(id);
      }
    }
    direct.set(group.id, own);
  }

  const flat = new Map<string, string[]>();
  const flatten = (id: string): string[] => {
    const known = flat.get(id);
    if (known !== undefined) return known;
    const out: string[] = [];
    for (const member of direct.get(id)!) {
      if (groupIds.has(member)) out.push(...flatten(member));
      else out.push(member);
    }
    flat.set(id, out);
    return out;
  };

  const live = new Set(declared.filter((g) => flatten(g.id).length > 0).map((g) => g.id));
  return declared.filter((g) => live.has(g.id)).map((g) => {
    const parent = parentOf.get(g.id);
    return {
      id: g.id,
      direct: direct.get(g.id)!.filter((id) => !groupIds.has(id) || live.has(id)),
      members: flat.get(g.id)!,
      ...(parent !== undefined ? { parent } : {}),
    };
  });
}
