import type { PrefBase, PrefLeaf } from './schema';

/**
 * A second place for another leaf: its row draws that leaf's control and
 * reads and writes that leaf's value, so one setting can sit on two pages.
 * It holds no value of its own. A store neither reads nor writes one, and
 * its path is not a {@link PrefPath}.
 *
 * `name` and `description` left empty are the target's.
 */
export interface PrefAlias extends PrefBase<'alias', undefined> {
  /** The leaf shown here, by the full path its value is read and written at (`'view.grid'`). */
  of: string;
}

/**
 * The leaf an alias stands for and the path its value lives at, following an
 * alias of an alias to its end. `undefined` when a path along the way names
 * no leaf, or the aliases lead back to one already passed.
 */
export function prefAliasTarget(
  alias: PrefAlias,
  leafAt: (path: string) => PrefLeaf | undefined,
): { path: string; leaf: PrefLeaf } | undefined {
  const passed = new Set<string>();
  let path = alias.of;
  for (;;) {
    if (passed.has(path)) return undefined;
    passed.add(path);
    const leaf = leafAt(path);
    if (leaf === undefined) return undefined;
    if (leaf.kind !== 'alias') return { path, leaf };
    path = (leaf as PrefAlias).of;
  }
}

/** A leaf drawn through an alias: the target, under the alias's own name and description where it gives them. */
export function prefAliasedLeaf(alias: PrefAlias, target: PrefLeaf): PrefLeaf {
  return {
    ...target,
    name: alias.name === '' ? target.name : alias.name,
    description: alias.description === '' ? target.description : alias.description,
  };
}
