import { useMemo } from 'react';
import { isPrefLeaf, type PrefGroup } from '@weasel-js/prefs';
import { Badge } from '../Badge';
import { Icon } from '../../icons';
import { PrefKindBadge } from '../Prefs/PrefKindBadge';
import { Tree, treeBranchIds, type TreeNode } from '../Tree';
import { seekRows, soughtRow } from './rowSearch';
import { GROUP_ICON, type PaletteDrag } from './Palette';
import { childrenOf, joinPath, keyOf, nodeAt, type SchemaNode } from './schemaEdit';
import { leafLabel, nodeLabel } from './structureRows';
import s from './PrefSchemaEditor.module.css';
import { icon } from '../../icons.gen';

/** Leaves to drag into the structure tree, each landing as a copy, and where each already sits. */
export interface PartsCatalog {
  /** Groups of leaves. */
  root: PrefGroup;
  /** The places the tree already holds what `leaf` names, by name: none for one it holds nowhere. */
  where(leaf: SchemaNode): readonly string[];
}

function toRows(node: SchemaNode, path: string | null, where: PartsCatalog['where']): TreeNode[] {
  return Object.entries(childrenOf(node) ?? {}).map(([key, child]): TreeNode => {
    const id = joinPath(path, key);
    const row = soughtRow({ id, label: nodeLabel(child.name, key) }, { text: [child.name, key], tags: child.tags });
    if (!isPrefLeaf(child)) return { ...row, leading: <Icon size={16} name={GROUP_ICON.section} />, children: toRows(child, id, where) };
    const held = where(child);
    return {
      ...row,
      label: leafLabel(row.label),
      ...(held.length > 0 ? { tooltip: `In ${held.join(', ')}` } : {}),
      trailing: (
        <>
          {held.length > 0 && <Badge size="xs" emphasis="low" variant="subtle">{held.length === 1 ? held[0] : `${held.length} places`}</Badge>}
          <PrefKindBadge kind={child.kind} />
        </>
      ),
    };
  });
}

/**
 * The parts a tree's leaves name, as a tree to drag them out of: a part lands as a copy of its leaf, and the list
 * keeps it. Each row says where the tree already holds it.
 */
export function PartsList({ parts, sought, ghost, onDrag, onDrop }: {
  parts: PartsCatalog;
  /** What the structure's filter holds, lowercased: only rows whose name, key, or a tag has it are listed. Empty for all. */
  sought: string;
  /** As `Tree`'s `ghost`. */
  ghost?: boolean;
  /** The drag left this tree and moved, or came back or ended (`null`). */
  onDrag(drag: PaletteDrag | null): void;
  onDrop(drag: PaletteDrag): void;
}) {
  const { root, where } = parts;
  const all = useMemo(() => toRows(root, null, where), [root, where]);
  const rows = useMemo(() => seekRows(all, sought), [all, sought]);
  const open = useMemo(() => treeBranchIds(all), [all]);
  const dragOf = (ids: readonly string[], point: { x: number; y: number }): PaletteDrag | null => {
    const id = ids.find((at) => isPrefLeaf(nodeAt(root, at) ?? root));
    if (id === undefined) return null;
    const node = nodeAt(root, id)!;
    return { item: { id, label: node.name, icon: icon('formLabel'), key: keyOf(id), make: () => node }, node, ...point };
  };
  return (
    <Tree
      aria-label="Parts"
      ghost={ghost}
      nodes={rows}
      empty={<p className={s.storedEmpty}>{all.length === 0 ? 'There are no parts.' : 'Nothing matches.'}</p>}
      foldBy="leading"
      guides
      defaultExpandedIds={open}
      // Rows leave this tree and never move within it.
      onMove={() => {}}
      canDrop={() => false}
      onDragOutside={(ids, point) => {
        const drag = point ? dragOf(ids, point) : null;
        onDrag(drag);
        return drag !== null;
      }}
      onDropOutside={(ids, point) => {
        const drag = dragOf(ids, point);
        if (drag) onDrop(drag);
        onDrag(null);
      }}
    />
  );
}
