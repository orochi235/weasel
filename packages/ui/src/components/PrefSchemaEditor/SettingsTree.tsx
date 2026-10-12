import { useMemo } from 'react';
import { isPrefLeaf, isPrefSection } from '@weasel-js/prefs';
import { Icon } from '../../icons';
import { PrefKindBadge } from '../Prefs/PrefKindBadge';
import { filterTree, Tree, treeBranchIds, type TreeNode } from '../Tree';
import { GROUP_ICON, type PaletteDrag } from './Palette';
import { childrenOf, joinPath, valuePathOf, type SchemaNode, type SchemaRoot } from './schemaEdit';
import { pointable, pointedAt, pointersTo } from './settingPointers';
import { nodeLabel } from './structureRows';
import s from './PrefSchemaEditor.module.css';

/** The rows for what `node` of the dialog `over` holds: its settings, and each group that holds one. */
function toRows(over: SchemaRoot, node: SchemaNode, path: string | null, placed: ReadonlySet<string>): TreeNode[] {
  return Object.entries(childrenOf(node) ?? {}).flatMap(([key, child]): TreeNode[] => {
    const id = joinPath(path, key);
    const row = { id, textValue: child.name ? `${child.name} ${key}` : key, ...(child.description ? { tooltip: child.description } : {}) };
    if (isPrefLeaf(child)) {
      if (!pointable(over, id)) return [];
      const label = nodeLabel(child.name, key);
      const pointed = placed.has(valuePathOf(over, id));
      return [{ ...row, label: pointed ? <span className={s.pointed}>{label}</span> : label, trailing: <PrefKindBadge kind={child.type ?? child.kind} /> }];
    }
    const children = toRows(over, child, id, placed);
    if (children.length === 0) return [];
    const as = child.as ?? (path === null && !isPrefSection(child) ? 'page' : 'section');
    return [{ ...row, label: nodeLabel(child.name, key), leading: <Icon size={16} name={GROUP_ICON[as]} />, children }];
  });
}

/**
 * The settings of the dialog a layout is over, as a tree to drag them out of. A setting lands in the layout as a
 * pointer to it, and a group as a heading over a pointer to each setting it holds; the dialog keeps them all. A
 * setting the layout already points at is drawn muted, and can be pointed at again.
 */
export function SettingsTree({ over, layout, sought, ghost, onDrag, onDrop }: {
  over: SchemaRoot;
  /** The layout shown, whose pointers say which settings it has. */
  layout: SchemaRoot;
  /** What the structure's filter holds, lowercased: only rows whose name or key has it are listed. Empty for all. */
  sought: string;
  /** As `Tree`'s `ghost`. */
  ghost?: boolean;
  /** The drag left this tree and moved, or came back or ended (`null`). */
  onDrag(drag: PaletteDrag | null): void;
  onDrop(drag: PaletteDrag): void;
}) {
  const placed = useMemo(() => pointedAt(layout, over), [layout, over]);
  const all = useMemo(() => toRows(over, over, null, placed), [over, placed]);
  const rows = useMemo(
    () => (sought === '' ? all : filterTree(all, (n) => (n.textValue ?? '').toLowerCase().includes(sought))),
    [all, sought],
  );
  const open = useMemo(() => treeBranchIds(all), [all]);
  // One row a drag: what it carries is new to the layout, and lands as one node.
  const dragOf = (ids: readonly string[], point: { x: number; y: number }): PaletteDrag | null => {
    const id = ids[0];
    const made = id === undefined ? undefined : pointersTo(over, id);
    if (id === undefined || !made) return null;
    return { item: { id, label: made.node.name, icon: 'link', key: made.key, make: () => made.node }, node: made.node, ...point };
  };
  return (
    <Tree
      aria-label="Settings"
      ghost={ghost}
      nodes={rows}
      empty={<p className={s.storedEmpty}>{all.length === 0 ? 'The dialog holds no settings.' : 'Nothing matches.'}</p>}
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
