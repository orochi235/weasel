import { useMemo } from 'react';
import { isPrefLeaf, type PrefGroup } from '@weasel-js/prefs';
import { Icon } from '../../icons';
import { PrefKindBadge } from '../Prefs/PrefKindBadge';
import { Tree, treeBranchIds, type TreeNode } from '../Tree';
import { seekRows, soughtRow } from './rowSearch';
import { GROUP_ICON, type PaletteDrag } from './Palette';
import { keyOf, type SchemaNode } from './schemaEdit';
import { unplacedAt } from './unplaced';
import s from './PrefSchemaEditor.module.css';
import { leafLabel, nodeLabel } from './structureRows';
import { nodeIcon } from './nodeIcon';
import { icon } from '../../icons.gen';

const SEP = '/';
/** What leads the id of a row the schema does not hold. No key holds a `/`, so no schema path starts with one. */
const NEW = SEP;

function toRows(group: PrefGroup, path: string): TreeNode[] {
  return Object.entries(group.children).map(([key, child]) => {
    const id = `${path}${path === NEW ? '' : SEP}${key}`;
    const label = nodeLabel(child.name, key);
    const row = soughtRow({ id, label, ...(child.description ? { tooltip: child.description } : {}) }, { text: [child.name, key], tags: child.tags });
    return isPrefLeaf(child)
      ? { ...row, label: leafLabel(label), leading: nodeIcon(child, false), trailing: <PrefKindBadge kind={child.kind} /> }
      : { ...row, leading: <Icon size={16} name={GROUP_ICON[child.as ?? 'section']} />, children: toRows(child, id) };
  });
}

/**
 * Nodes waiting for a place in the schema, as a tree to drag them out of: what the schema holds on no page, then
 * what its host says it does not hold yet. Each is whole already, with its key, its name and its description, and
 * lands as it is wherever the structure tree or the live preview takes it. A group dragged brings what it holds.
 */
export function UnplacedTree({ loose, looseAt, waiting, sought, selected, onPick, ghost, onDrag, onDrop }: {
  /** The rows of what the schema holds on no page, each by its tree path. */
  loose: readonly TreeNode[];
  /** The schema's node at a tree path. */
  looseAt(path: string): SchemaNode | undefined;
  /** What the schema does not hold yet; `null` when nothing is left. */
  waiting: PrefGroup | null;
  /** What the structure's filter holds, lowercased: only rows whose name, key, or a tag has it are listed. Empty for all. */
  sought: string;
  /** The tree paths selected in the editor, each marked here when it is one of these rows. */
  selected: readonly string[];
  /** The selection after a pick here, as tree paths: a row of the other tree stays in it through a Cmd-click. */
  onPick(paths: readonly string[]): void;
  /** As `Tree`'s `ghost`. */
  ghost?: boolean;
  /** The drag left this tree and moved, or came back or ended (`null`). */
  onDrag(drag: PaletteDrag | null): void;
  onDrop(drag: PaletteDrag): void;
}) {
  const all = useMemo(() => [...loose, ...(waiting ? toRows(waiting, NEW) : [])], [loose, waiting]);
  const rows = useMemo(
    () => seekRows(all, sought),
    [all, sought],
  );
  const open = useMemo(() => treeBranchIds(all), [all]);
  /** The drag of the rows at `ids`: every one of them where the schema holds them all, which a drop then moves,
   *  and otherwise the first alone, since a node the schema does not hold lands as one new node. */
  const dragOf = (ids: readonly string[], point: { x: number; y: number }): PaletteDrag | null => {
    const id = ids[0];
    if (id === undefined) return null;
    const held = !id.startsWith(NEW);
    const node = held ? looseAt(id) : waiting ? unplacedAt(waiting, id.slice(NEW.length).split(SEP)) : undefined;
    if (!node) return null;
    const key = held ? keyOf(id) : id.split(SEP).at(-1)!;
    const from = ids.every((x) => !x.startsWith(NEW)) ? ids : [id];
    return { item: { id, label: node.name, icon: icon('formLabel'), key, make: () => node }, node, ...(held ? { from } : {}), ...point };
  };
  return (
    <Tree
      aria-label="Unplaced"
      ghost={ghost}
      nodes={rows}
      empty={<p className={s.storedEmpty}>{all.length === 0 ? 'Nothing is waiting for a place.' : 'Nothing matches.'}</p>}
      foldBy="leading"
      guides
      defaultExpandedIds={open}
      selectionMode="multiple"
      selectionFollowsFocus
      selectedIds={selected}
      // Only a row the schema holds has attributes to show, so a pick of one it does not hold changes nothing.
      onSelectionChange={(ids) => {
        const held = [...ids].filter((id) => !id.startsWith(NEW));
        if (held.length > 0 || ids.size === 0) onPick(held);
      }}
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
