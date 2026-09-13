import { type LabChromeContext, usePersistedState } from '@weasel-js/labkit';
import { type FocusEvent, type KeyboardEvent, type ReactNode, useId, useMemo, useRef, useState } from 'react';
import type { IndexEntry } from '../../story/types';
import { revealTrial } from '../revealTrial';
import { useRoute } from '../useRoute';
import { buildTree, filterTree, type TreeNode } from './buildTree';

export interface StoryTreeProps {
  ctx: LabChromeContext;
  index: readonly IndexEntry[];
}

interface Row {
  key: string;
  node: TreeNode;
  parent: string | null;
}

const keyOf = (node: TreeNode): string => (node.kind === 'folder' ? `folder:${node.path}` : `story:${node.entry.id}`);

/** The folder paths above a story's component, and the component's own. */
function ancestorsOf(entry: IndexEntry | undefined): Set<string> {
  const paths = new Set<string>();
  if (!entry) return paths;
  let path = '';
  for (const label of entry.title.split('/')) {
    path = path ? `${path}/${label}` : label;
    paths.add(path);
  }
  return paths;
}

/** The indexed stories as a filterable tree; opening one opens, or reveals, its trial. */
export function StoryTree({ ctx, index }: StoryTreeProps) {
  const headingId = useId();
  const [route, setRoute] = useRoute();
  const [query, setQuery] = useState('');
  const [folds, setFolds] = usePersistedState<Record<string, boolean>>('fg-tree-open', {}, { scope: 'lab' });
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const items = useRef(new Map<string, HTMLElement>());

  const tree = useMemo(() => buildTree(index), [index]);
  const shown = useMemo(() => filterTree(tree, query), [tree, query]);
  const routed = index.find((entry) => entry.id === route);
  const routeAncestors = useMemo(() => ancestorsOf(routed), [routed]);
  const filtering = query.trim() !== '';
  const isOpen = (path: string): boolean => filtering || (folds[path] ?? routeAncestors.has(path));

  const rows: Row[] = [];
  const collect = (nodes: readonly TreeNode[], parent: string | null): void => {
    for (const node of nodes) {
      rows.push({ key: keyOf(node), node, parent });
      if (node.kind === 'folder' && isOpen(node.path)) collect(node.children, keyOf(node));
    }
  };
  collect(shown, null);
  const active = rows.some((row) => row.key === focusKey) ? focusKey : (rows[0]?.key ?? null);

  const openIds = new Set(ctx.trials.map((trial) => trial.instrumentName));

  // A filter forces every folder open, so a toggle then would change state nobody can see.
  const setOpen = (path: string, open: boolean): void => {
    if (!filtering) setFolds((prev) => ({ ...prev, [path]: open }));
  };

  const moveTo = (key: string | undefined): void => {
    if (key === undefined) return;
    setFocusKey(key);
    items.current.get(key)?.focus();
  };

  const activate = (entry: IndexEntry, fresh: boolean): void => {
    const open = ctx.trials.find((trial) => trial.instrumentName === entry.id);
    if (open && !fresh) revealTrial(open.id);
    else ctx.addTrial(entry.id);
    setRoute(entry.id);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const at = rows.findIndex((row) => row.key === active);
    const row = rows[at];
    if (!row) return;
    const { node } = row;
    switch (event.key) {
      case 'ArrowDown':
        moveTo(rows[at + 1]?.key);
        break;
      case 'ArrowUp':
        moveTo(rows[at - 1]?.key);
        break;
      case 'Home':
        moveTo(rows[0]?.key);
        break;
      case 'End':
        moveTo(rows[rows.length - 1]?.key);
        break;
      case 'ArrowRight':
        if (node.kind !== 'folder') break;
        if (!isOpen(node.path)) setOpen(node.path, true);
        else if (rows[at + 1]?.parent === row.key) moveTo(rows[at + 1]?.key);
        break;
      case 'ArrowLeft':
        if (node.kind === 'folder' && isOpen(node.path) && !filtering) setOpen(node.path, false);
        else moveTo(row.parent ?? undefined);
        break;
      case 'Enter':
      case ' ':
        if (node.kind === 'folder') setOpen(node.path, !isOpen(node.path));
        else activate(node.entry, event.metaKey || event.ctrlKey);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const itemProps = (node: TreeNode, level: number) => {
    const key = keyOf(node);
    return {
      role: 'treeitem',
      'aria-level': level,
      tabIndex: key === active ? 0 : -1,
      ref: (el: HTMLElement | null) => {
        if (el) items.current.set(key, el);
        else items.current.delete(key);
      },
      // A folder item contains its children, so their focus bubbles through it.
      onFocus: (event: FocusEvent) => {
        if (event.target === event.currentTarget) setFocusKey(key);
      },
    };
  };

  const renderNodes = (nodes: readonly TreeNode[], level: number): ReactNode =>
    nodes.map((node) => {
      if (node.kind === 'folder') {
        const open = isOpen(node.path);
        return (
          <div
            key={keyOf(node)}
            {...itemProps(node, level)}
            aria-expanded={open}
            aria-label={node.label}
            className="fg-tree__node"
          >
            <div className="fg-tree__item fg-tree__folder" onClick={() => setOpen(node.path, !open)}>
              <span className="fg-tree__label">{node.label}</span>
            </div>
            {open ? (
              <div role="group" className="fg-tree__group">
                {renderNodes(node.children, level + 1)}
              </div>
            ) : null}
          </div>
        );
      }
      const { entry } = node;
      return (
        <a
          key={keyOf(node)}
          {...itemProps(node, level)}
          href={`#/${encodeURIComponent(entry.id)}`}
          aria-current={openIds.has(entry.id) ? 'true' : undefined}
          className="fg-tree__item fg-tree__story"
          onClick={(event) => {
            if (event.button !== 0 || event.shiftKey || event.altKey) return;
            event.preventDefault();
            setFocusKey(keyOf(node));
            activate(entry, event.metaKey || event.ctrlKey);
          }}
        >
          <span className="fg-tree__label">{entry.name}</span>
        </a>
      );
    });

  return (
    <section className="fg-tree">
      <h2 id={headingId} className="fg-tree__heading">
        Stories
      </h2>
      {route && !routed ? (
        <p className="fg-route-miss">
          No story <code>{route}</code>
        </p>
      ) : null}
      <input
        type="search"
        className="fg-tree__filter"
        aria-label="Filter stories"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div role="tree" aria-labelledby={headingId} className="fg-tree__items" onKeyDown={onKeyDown}>
        {renderNodes(shown, 1)}
      </div>
    </section>
  );
}
