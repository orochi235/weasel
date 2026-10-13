import { useMemo, useRef } from 'react';
import type { PrefLeaf } from '@weasel-js/prefs';
import { ShortcutKeys } from '../Keycaps';
import { filterTree, Tree, treeBranchIds, type TreeNode } from '../Tree';
import { actionLeaf, actionLeafKey, type EditorAction } from './editorActions';
import type { PaletteDrag } from './Palette';
import s from './PrefSchemaEditor.module.css';

/** What leads a group row's id. No action key is asked to start with it: a row is looked up among the actions. */
const GROUP = 'group:';

function toRows(actions: readonly EditorAction[]): TreeNode[] {
  const row = (a: EditorAction): TreeNode => ({
    id: a.key,
    label: <>{a.label} <span className={s.treeKey}>({a.key})</span></>,
    textValue: `${a.label} ${a.key}`,
    ...(a.icon != null ? { leading: a.icon } : {}),
    ...(a.shortcut ? { trailing: <ShortcutKeys legend={a.shortcut} /> } : {}),
  });
  const loose: TreeNode[] = [];
  const groups = new Map<string, TreeNode[]>();
  for (const a of actions) {
    if (a.group === undefined) loose.push(row(a));
    else groups.set(a.group, [...(groups.get(a.group) ?? []), row(a)]);
  }
  return [
    ...[...groups].map(([name, children]) => ({ id: `${GROUP}${name}`, label: name, textValue: name, children })),
    ...loose,
  ];
}

/**
 * The actions a host has, as a tree to drag them out of. One let go over the structure tree or the live preview
 * lands as a pref that fires it by key. An action stays listed however many prefs fire it: a toolbar and a menu
 * may both hold one.
 */
export function ActionList({ actions, sought, ghost, onDrag, onDrop }: {
  actions: readonly EditorAction[];
  /** What the structure's filter holds, lowercased: only rows whose label or key has it are listed. Empty for all. */
  sought: string;
  /** As `Tree`'s `ghost`. */
  ghost?: boolean;
  /** The drag left this tree and moved, or came back or ended (`null`). */
  onDrag(drag: PaletteDrag | null): void;
  onDrop(drag: PaletteDrag): void;
}) {
  const all = useMemo(() => toRows(actions), [actions]);
  const rows = useMemo(
    () => (sought === '' ? all : filterTree(all, (n) => (n.textValue ?? '').toLowerCase().includes(sought))),
    [all, sought],
  );
  const open = useMemo(() => treeBranchIds(all), [all]);
  // One node per drag, so it is seen as holding the same thing from one pointer move to the next.
  const held = useRef<{ id: string; node: PrefLeaf } | null>(null);
  const dragOf = (id: string, point: { x: number; y: number }): PaletteDrag | null => {
    const action = actions.find((a) => a.key === id);
    if (!action) return null;
    if (held.current?.id !== id) held.current = { id, node: actionLeaf(action) };
    const node = held.current.node;
    return { item: { id, label: action.label, icon: 'formLabel', key: actionLeafKey(action.key), make: () => node }, node, ...point };
  };
  return (
    <Tree
      aria-label="Actions"
      ghost={ghost}
      nodes={rows}
      empty={<p className={s.storedEmpty}>{all.length === 0 ? 'No actions are registered.' : 'Nothing matches.'}</p>}
      defaultExpandedIds={open}
      selectionMode="none"
      // Rows leave this tree and never move within it.
      onMove={() => {}}
      canDrop={() => false}
      onDragOutside={(ids, point) => {
        const drag = point && ids[0] !== undefined ? dragOf(ids[0], point) : null;
        if (!drag) held.current = null;
        onDrag(drag);
        return drag !== null;
      }}
      onDropOutside={(ids, point) => {
        const drag = ids[0] !== undefined ? dragOf(ids[0], point) : null;
        held.current = null;
        if (drag) onDrop(drag);
        onDrag(null);
      }}
    />
  );
}
