/** Adding a node from the structure pane's tools: where it lands, what it is made as, and the dialog that names it. */
import { useMemo, useState } from 'react';
import {
  addNode, blankGroup, blankSection, branchUnder, childrenOf, type CustomKinds, joinPath, keyOf, keysTakenAt,
  kindChoices, leafOf, nodeAt, parentPath, type PrefTypes, type SchemaNode, type SchemaRoot,
} from '@weasel-js/prefs/edit';
import type { NewNode } from './AddNodeDialog';
import type { PaletteLanding } from './usePaletteDrop';

/** Where an add lands: inside the lead if it holds children, else after it. */
function addTargetOf(schema: SchemaRoot, lead: string | null): { parent: string | null; index?: number } {
  const node = lead === null ? undefined : nodeAt(schema, lead);
  if (lead === null || !node) return { parent: null };
  if (childrenOf(node)) return { parent: lead };
  const parent = parentPath(lead);
  const sibs = Object.keys(childrenOf(nodeAt(schema, parent)!) ?? {});
  return { parent, index: sibs.indexOf(keyOf(lead)) + 1 };
}

/** What a new node may be: the kinds and types a pref is made from, and what a custom kind starts with. */
export interface NodeMaking {
  kinds: readonly string[];
  types: PrefTypes;
  custom?: CustomKinds;
}

/**
 * The add of a pref or a branch at `lead`: `open` starts one, and `dialog` is the props of the `AddNodeDialog` that
 * names it. The new node is selected, and its parent opened.
 */
export function useNodeAdder(schema: SchemaRoot, lead: string | null, pageless: boolean, making: NodeMaking, landing: Omit<PaletteLanding, 'move'>) {
  const { kinds, types, custom } = making;
  const [adding, setAdding] = useState<'pref' | 'branch' | null>(null);
  const target = addTargetOf(schema, lead);
  /** What a new node joins. */
  const host = nodeAt(schema, target.parent) ?? schema;
  const branch = branchUnder(host);
  const choices = useMemo(() => kindChoices(kinds, types), [kinds, types]);
  // Unset, a group under the root is drawn as a page, which a layout has none of.
  const heading = pageless && target.parent === null;
  const add = ({ key, name, kind }: NewNode) => {
    const node: SchemaNode = kind !== undefined ? { ...leafOf(kind, types, custom), name } : { ...(branch === 'section' ? blankSection() : blankGroup()), ...(heading ? { as: 'section' as const } : {}), name };
    setAdding(null);
    const { parent, index } = target;
    landing.onChange(addNode(schema, parent, key, node, index));
    if (parent !== null) landing.onExpandedChange((e) => new Set(e).add(parent));
    landing.onSelect([joinPath(parent, key)]);
  };
  return {
    branch,
    parent: target.parent,
    open: setAdding,
    dialog: {
      what: adding === 'branch' ? branch : adding,
      kinds: choices,
      onAdd: add,
      taken: keysTakenAt(schema, target.parent, adding === 'pref'),
      dottedKey: adding === 'pref' && branch === 'section',
      onClose: () => setAdding(null),
    },
  };
}
