import { useMemo, useRef, useState } from 'react';
import { isPrefLeaf } from '@weasel-js/prefs';
import { Badge } from '../Badge';
import { ShortcutKeys } from '../Keycaps';
import { Tree, treeBranchIds, type TreeNode } from '../Tree';
import { seekRows, soughtRow } from './rowSearch';
import { firedBy, keyTails } from './actionCatalog';
import type { EditorAction } from './editorActions';
import type { PaletteDrag } from './Palette';
import s from './PrefSchemaEditor.module.css';
import { childrenOf, joinPath, keyOf, nodeAt, type SchemaNode } from './schemaEdit';
import { nodeLabel } from './structureRows';
import type { ActionCatalog } from './useActionCatalog';
import { icon } from '../../icons.gen';

/** The rows for what `node` of a catalog holds: a group by its name, and a pref by its own and what its action brings. */
function toRows(node: SchemaNode, path: string | null, tails: ReadonlyMap<string, string>, registered: ReadonlyMap<string, EditorAction>): TreeNode[] {
  return Object.entries(childrenOf(node) ?? {}).map(([key, child]): TreeNode => {
    const id = joinPath(path, key);
    const fires = firedBy(child);
    const action = fires === undefined ? undefined : registered.get(fires);
    const tail = tails.get(id) ?? (isPrefLeaf(child) ? key : '');
    const tags = [...(child.tags ?? []), ...(action?.tags ?? [])];
    const row = soughtRow({ id, label: nodeLabel(child.name, tail), ...(child.description ? { tooltip: child.description } : {}) }, { text: [child.name, fires ?? tail], tags });
    if (!isPrefLeaf(child)) return { ...row, children: toRows(child, id, tails, registered) };
    return {
      ...row,
      ...(action?.icon != null ? { leading: action.icon } : {}),
      ...(fires !== undefined && !action
        ? { trailing: <Badge size="xs" grade="danger" variant="subtle">no action</Badge> }
        : action?.shortcut ? { trailing: <ShortcutKeys legend={action.shortcut} /> } : {}),
    };
  });
}

/**
 * The host's actions as a tree: the catalog's groups, and a pref for each action. A row is selected to see its
 * attributes, dragged within the tree to sort it where the catalog takes edits, and dragged out onto the structure
 * tree or the live preview to land there as a copy of its pref. An action stays listed however many prefs fire it:
 * a toolbar and a menu may both hold one.
 */
export function ActionList({ catalog, sought, ghost, onDrag, onDrop }: {
  catalog: ActionCatalog;
  /** What the structure's filter holds, lowercased: only rows whose name, key, or a tag has it are listed. Empty for all. */
  sought: string;
  /** As `Tree`'s `ghost`. */
  ghost?: boolean;
  /** The drag left this tree and moved, or came back or ended (`null`). */
  onDrag(drag: PaletteDrag | null): void;
  onDrop(drag: PaletteDrag): void;
}) {
  const { root, actions } = catalog;
  const all = useMemo(() => toRows(root, null, keyTails(root), new Map(actions.map((a) => [a.key, a]))), [root, actions]);
  const rows = useMemo(
    () => seekRows(all, sought),
    [all, sought],
  );
  // What is folded, so that a group made or moved since starts open.
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
  const branches = useMemo(() => treeBranchIds(all), [all]);
  // One node per drag, so it is seen as holding the same thing from one pointer move to the next.
  const held = useRef<{ id: string; node: SchemaNode } | null>(null);
  const dragOf = (ids: readonly string[], point: { x: number; y: number }): PaletteDrag | null => {
    const id = ids.find((at) => firedBy(nodeAt(root, at) ?? root) !== undefined);
    if (id === undefined) return null;
    // A copy: the catalog keeps its own.
    if (held.current?.id !== id) held.current = { id, node: { ...nodeAt(root, id)! } };
    const node = held.current.node;
    return { item: { id, label: node.name, icon: icon('formLabel'), key: keyOf(id), make: () => node }, node, ...point };
  };
  return (
    <Tree
      aria-label="Actions"
      hang
      ghost={ghost}
      nodes={rows}
      empty={<p className={s.storedEmpty}>{all.length === 0 ? 'No actions are registered.' : 'Nothing matches.'}</p>}
      expandedIds={sought !== '' ? treeBranchIds(rows) : [...branches].filter((id) => !folded.has(id))}
      onExpandedChange={(open) => {
        if (sought === '') setFolded(new Set([...branches].filter((id) => !open.has(id))));
      }}
      selectionMode="multiple"
      selectionFollowsFocus
      selectedIds={catalog.selected}
      onSelectionChange={catalog.pick}
      onMove={(ids, t) => catalog.move(ids, { parentPath: t.parentId, index: t.index })}
      // A place among the rows shown is not that place among all of them, and nothing from outside lands here.
      canDrop={(ids) => catalog.editable && sought === '' && ids.length > 0}
      onDragOutside={(ids, point) => {
        const drag = point ? dragOf(ids, point) : null;
        if (!drag) held.current = null;
        onDrag(drag);
        return drag !== null;
      }}
      onDropOutside={(ids, point) => {
        const drag = dragOf(ids, point);
        held.current = null;
        if (drag) onDrop(drag);
        onDrag(null);
      }}
    />
  );
}
