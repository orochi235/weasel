import { type LabChromeContext, usePersistedState } from '@weasel-js/labkit';
import { Badge, Checkbox, DisclosureMark, ToggleBar, type ToggleBarItem } from '@weasel-js/ui';
import { type FocusEvent, type KeyboardEvent, type ReactNode, useId, useMemo, useRef, useState } from 'react';
import { indexEntries } from '../../story/indexPages';
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

/** Each package's peer tone: its swatch mixed toward the foreground, so the
 *  badge text keeps its contrast in both modes. */
const LIBRARY_TONES: Readonly<Record<string, string>> = {
  ui: 'color-mix(in oklab, var(--wzl-swatch-blue), var(--wzl-fg) 35%)',
  labkit: 'color-mix(in oklab, var(--wzl-swatch-teal), var(--wzl-fg) 45%)',
  forge: 'color-mix(in oklab, var(--wzl-swatch-amber), var(--wzl-fg) 40%)',
  draw: 'color-mix(in oklab, var(--wzl-swatch-rose), var(--wzl-fg) 35%)',
};

/** A component's package, as a badge toned per package. */
function LibraryBadge({ library }: { library: string }) {
  return (
    <Badge status="muted" tone={LIBRARY_TONES[library]} variant="subtle" size="sm" className="fg-tree__tag">
      {library}
    </Badge>
  );
}

/** The indexed stories as a filterable tree; opening one runs it in the focused trial, or with Shift in another. */
export function StoryTree({ ctx, index }: StoryTreeProps) {
  const headingId = useId();
  const [route, setRoute] = useRoute();
  const [query, setQuery] = useState('');
  const [folds, setFolds] = usePersistedState<Record<string, boolean>>('fg-tree-open', {}, { scope: 'lab' });
  const [view, setView] = usePersistedState<View>('fg-tree-view', 'components', { scope: 'lab' });
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
  const routable = useMemo(() => [...kept, ...indexEntries(kept)], [kept]);
  const routed = routable.find((entry) => entry.id === route);
  const routeAncestors = useMemo(() => ancestorsOf(routed), [routed]);
  const filtering = query.trim() !== '';
  const isOpen = (path: string): boolean =>
    filtering || (folds[path] ?? routeAncestors.has(path));

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

  // A component's row opens its index page as well as its folder; the fold mark alone only folds.
  const openFolder = (node: Extract<TreeNode, { kind: 'folder' }>, another: boolean): void => {
    if (!node.index) {
      setOpen(node.path, !isOpen(node.path));
      return;
    }
    // Selection opens it, and closes it again once the selection moves on; only a manual fold is stored. A
    // manual close would outrank the selection, so it is dropped.
    if (folds[node.path] === false) {
      setFolds(({ [node.path]: _dropped, ...rest }) => rest);
    }
    activate(node.index, another);
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
        if (node.kind === 'story') activate(node.entry, event.shiftKey);
        else openFolder(node, event.shiftKey);
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
            aria-current={node.index && openIds.has(node.index.id) ? 'true' : undefined}
            className="fg-tree__node"
          >
            <div
              className="fg-tree__item fg-tree__folder"
              onClick={(event) => {
                setFocusKey(keyOf(node));
                openFolder(node, event.shiftKey);
              }}
            >
              <span
                aria-hidden="true"
                className="fg-tree__fold"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(node.path, !open);
                }}
              >
                <DisclosureMark open={open} />
              </span>
              <span className="fg-tree__label">{node.label}</span>
              {node.tag ? <LibraryBadge library={node.tag} /> : null}
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
          {node.tag ? <LibraryBadge library={node.tag} /> : null}
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
            <LibraryBadge library={library} />
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
