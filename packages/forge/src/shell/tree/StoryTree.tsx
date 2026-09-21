import { type LabChromeContext, usePersistedState } from '@weasel-js/labkit';
import { Checkbox, ToggleBar, type ToggleBarItem } from '@weasel-js/ui';
import { type FocusEvent, type KeyboardEvent, type ReactNode, useId, useMemo, useRef, useState } from 'react';
import type { IndexEntry } from '../../story/types';
import { revealTrial } from '../revealTrial';
import { useRoute } from '../useRoute';
import { buildTree, filterTree, type TreeNode } from './buildTree';
import { buildComponents, componentNodes, filterComponents, librariesIn, libraryOf } from './buildComponents';

/** Which shape the sidebar lists the index in. */
type View = 'tree' | 'components';

const VIEWS: readonly ToggleBarItem<View>[] = [
  { value: 'tree', label: 'Tree' },
  { value: 'components', label: 'Components' },
];

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

/** The indexed stories as a filterable tree; opening one runs it in the focused trial, or with Shift in another. */
export function StoryTree({ ctx, index }: StoryTreeProps) {
  const headingId = useId();
  const [route, setRoute] = useRoute();
  const [query, setQuery] = useState('');
  const [folds, setFolds] = usePersistedState<Record<string, boolean>>('fg-tree-open', {}, { scope: 'lab' });
  const [view, setView] = usePersistedState<View>('fg-tree-view', 'tree', { scope: 'lab' });
  // Stored as what is *off*, so a library added later is on without anyone
  // going back to tick it.
  const [hidden, setHidden] = usePersistedState<Record<string, boolean>>('fg-tree-libraries', {}, { scope: 'lab' });
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const items = useRef(new Map<string, HTMLElement>());

  const libraries = useMemo(() => librariesIn(index), [index]);
  // The package filter runs on the index, so it means the same thing in both
  // views rather than once per view's own grouping.
  const kept = useMemo(() => index.filter((entry) => !hidden[libraryOf(entry)]), [index, hidden]);
  const tree = useMemo(() => buildTree(kept), [kept]);
  const components = useMemo(() => buildComponents(kept), [kept]);
  const shown = useMemo(
    () =>
      view === 'components'
        ? componentNodes(filterComponents(components, query))
        : filterTree(tree, query),
    [view, components, tree, query],
  );
  const routed = kept.find((entry) => entry.id === route);
  const routeAncestors = useMemo(() => ancestorsOf(routed), [routed]);
  const filtering = query.trim() !== '';
  const isOpen = (path: string): boolean =>
    filtering || (folds[path] ?? (view === 'tree' && routeAncestors.has(path)));

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

  const activate = (entry: IndexEntry, another: boolean): void => {
    const focused = ctx.trials.find((trial) => trial.id === ctx.focusedTrialId);
    if (another || !focused) ctx.addTrial(entry.id);
    else if (focused.instrumentName === entry.id) revealTrial(focused.id);
    else {
      ctx.swapTrial(focused.id, entry.id);
      setRoute(entry.id, { inPlace: true });
      return;
    }
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
        else activate(node.entry, event.shiftKey);
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
              {node.tag ? <span className="fg-tree__tag">{node.tag}</span> : null}
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
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey) return;
            event.preventDefault();
            setFocusKey(keyOf(node));
            activate(entry, event.shiftKey);
          }}
        >
          <span className="fg-tree__label">{node.label ?? entry.name}</span>
          {node.tag ? <span className="fg-tree__tag">{node.tag}</span> : null}
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
      <ToggleBar
        ariaLabel="Sidebar view"
        variant="flat"
        items={VIEWS}
        value={view}
        onChange={(next) => {
          if (next) setView(next);
        }}
      />
      <fieldset className="fg-tree__libraries">
        <legend className="fg-tree__libraries-legend">Packages</legend>
        {libraries.map((library) => (
          <Checkbox
            key={library}
            isSelected={!hidden[library]}
            onChange={(on) => setHidden((prev) => ({ ...prev, [library]: !on }))}
          >
            {library}
          </Checkbox>
        ))}
      </fieldset>
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
