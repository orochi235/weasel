import {
  isPrefLeaf,
  isPrefSection,
  prefHoldsValue,
  prefSchemaHolding,
  prefSectionLeaves,
  type PrefGroup,
  type PrefLeaf,
  type PrefList,
  type PrefMap,
  type PrefObject,
  type PrefSection,
  type PrefTest,
} from '@weasel-js/prefs';

/** A leaf a condition may read, with the path its value is read at: from the schema root, or with `from`, from the
 *  entry the condition's node is drawn in. */
export interface ConditionLeaf {
  path: string;
  leaf: PrefLeaf;
  from?: 'item';
  /** The leaf is one of the schema the condition's is drawn over, and not of its own. */
  over?: true;
}

/** What tells one {@link ConditionLeaf} from another: a field of the entry and a root pref may share a path. */
export const leafKey = ({ path, from }: Pick<ConditionLeaf, 'path' | 'from'>): string => (from === 'item' ? `item\n${path}` : path);

/** The one of `leaves` that `test` reads. */
export function leafOf(leaves: readonly ConditionLeaf[], test: PrefTest): ConditionLeaf | undefined {
  return leaves.find((l) => l.path === test.path && l.from === test.from);
}

/**
 * Every leaf of `schema` that holds a value, a field of an `object` leaf among them, in schema order. With
 * `entryOf`, the list or map whose entry the condition's node is drawn in, the fields of that entry come first,
 * each read from the entry. With `over`, the schema `schema` is drawn over, that schema's leaves come last, less
 * each at a path a leaf of `schema` holds, which a condition reads there.
 */
export function conditionLeaves(schema: PrefGroup | PrefSection, entryOf?: PrefList | PrefMap, over?: PrefGroup | PrefSection): ConditionLeaf[] {
  const out: ConditionLeaf[] = [];
  const add = (path: string, leaf: PrefLeaf, mark: Pick<ConditionLeaf, 'from' | 'over'>): void => {
    if (!prefHoldsValue(leaf)) return;
    if (path !== '' && !(mark.over && prefSchemaHolding(schema, path, over) === schema)) out.push({ path, leaf, ...mark });
    if (leaf.kind !== 'object') return;
    for (const [key, field] of prefSectionLeaves((leaf as PrefObject).children)) add(path === '' ? key : `${path}.${key}`, field, mark);
  };
  // The entry itself is what the node sits in, and no row reads it whole.
  if (entryOf?.item) add('', entryOf.item, { from: 'item' });
  const all = (of: PrefGroup | PrefSection, mark: Pick<ConditionLeaf, 'over'>): void => {
    const walk = (group: PrefGroup, prefix: string): void => {
      for (const [key, child] of Object.entries(group.children)) {
        const path = prefix === '' ? key : `${prefix}.${key}`;
        if (isPrefLeaf(child)) add(path, child, mark);
        else walk(child, path);
      }
    };
    if (isPrefSection(of)) for (const [key, leaf] of prefSectionLeaves(of.members)) add(key, leaf, mark);
    else walk(of, '');
  };
  all(schema, {});
  if (over) all(over, { over: true });
  return out;
}
