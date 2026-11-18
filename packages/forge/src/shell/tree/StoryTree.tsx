import { type LabChromeContext, usePersistedState } from '@weasel-js/labkit';
import { SegmentedBar } from '@weasel-js/ui/components/Segmented';
import { ToggleChips } from '@weasel-js/ui/components/ToggleChips';
import { Tree, type TreeProps } from '@weasel-js/ui/components/Tree';
import { useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { getOwn } from '@weasel-js/registry';
import { indexEntries } from '../../story/indexPages';
import type { IndexEntry } from '../../story/types';
import { onRevealInTree } from '../treeReveal';
import { useRoute } from '../useRoute';
import { filterTree, type TreeNode as StoryNode } from './buildTree';
import { componentNodes, filterComponents, librariesIn } from './buildComponents';
import { LibrariesContext } from '../../story/library';
import { folderPathsOf, revealedFolderIn, useRowScroll } from './folderReveal';
import { openStory } from './openStory';
import { useSidebarViews, type View, VIEWS } from './sidebarViews';
import { keyOf, LibraryBadge, type StoryFolder, treeRowsFor } from './treeRows';

export interface StoryTreeProps {
  ctx: LabChromeContext;
  index: readonly IndexEntry[];
}

const pathOf = (byId: ReadonlyMap<string, StoryNode>, id: string): string => (byId.get(id) as StoryFolder).path;

interface LibraryFilterProps {
  readonly libraries: readonly string[];
  readonly hidden: Readonly<Record<string, boolean>>;
  readonly onHiddenChange: (hidden: Record<string, boolean>) => void;
}

/** The package chips, each turning its package's stories on or off. */
function LibraryFilter({ libraries, hidden, onHiddenChange }: LibraryFilterProps) {
  const librariesId = useId();
  const chips = useMemo(() => libraries.map((library) => ({ value: library, label: <LibraryBadge library={library} /> })), [libraries]);
  const on = libraries.filter((library) => !getOwn(hidden, library));
  return (
    <div className="fg-tree__libraries">
      <span id={librariesId} className="fg-tree__libraries-legend">Packages</span>
      <ToggleChips
        aria-labelledby={librariesId}
        sweep
        items={chips}
        value={on}
        onChange={(next) => onHiddenChange(Object.fromEntries(libraries.map((library) => [library, !next.includes(library)])))}
      />
    </div>
  );
}

/** The indexed stories as a filterable tree; opening one runs it in the focused trial, or with Shift in another. */
export function StoryTree({ ctx, index }: StoryTreeProps) {
  const headingId = useId();
  const [route] = useRoute();
  const [query, setQuery] = useState('');
  const [folds, setFolds] = usePersistedState<Record<string, boolean>>('fg-tree-open', {}, { scope: 'lab' });
  const [chosen, setView] = usePersistedState<View>('fg-tree-view', 'components', { scope: 'lab' });
  // Stored as what is *off*, so a library added later is on without anyone
  // going back to tick it.
  const [hidden, setHidden] = usePersistedState<Record<string, boolean>>('fg-tree-libraries', {}, { scope: 'lab' });

  const table = useContext(LibrariesContext);
  const libraries = useMemo(() => librariesIn(index, table), [index, table]);
  const { views, view, enabled, tree, components, galleries, nodesOf } = useSidebarViews(index, table, hidden, chosen);
  const shown = useMemo(
    () =>
      view === 'tree'
        ? filterTree(tree, query)
        : componentNodes(filterComponents(view === 'gallery' ? galleries : components, query)),
    [view, components, galleries, tree, query],
  );
  const routable = useMemo(() => [...index, ...indexEntries(index)], [index]);
  const routed = routable.find((entry) => entry.id === route);
  const routeAncestors = useMemo(() => new Set(routed ? folderPathsOf(routed.title) : []), [routed]);
  const filtering = query.trim() !== '';
  const openKey = ctx.trials.map((trial) => trial.instrumentName).join('\n');
  const openIds = useMemo(() => new Set(openKey.split('\n')), [openKey]);

  const { nodes, byId, folders: folderIds } = useMemo(() => treeRowsFor(shown, openIds), [shown, openIds]);
  const expanded = useMemo(
    () => new Set(folderIds.filter((id) => filtering || (getOwn(folds, pathOf(byId, id)) ?? routeAncestors.has(pathOf(byId, id))))),
    [folderIds, byId, filtering, folds, routeAncestors],
  );

  // A filter forces every folder open, so a toggle then would change state nobody can see.
  const onExpandedChange = (next: Set<string>): void => {
    if (filtering) return;
    const changed = folderIds.filter((id) => next.has(id) !== expanded.has(id));
    if (changed.length) setFolds((prev) => ({ ...prev, ...Object.fromEntries(changed.map((id) => [pathOf(byId, id), next.has(id)])) }));
  };

  const activate = (entry: IndexEntry, another: boolean): void => openStory(ctx, entry, another);

  // A component's row opens its index page, which opens its folder; only the fold mark folds it. Selection opens
  // it, and closes it again once the selection moves on; only a manual fold is stored. The row's activation has
  // already toggled the fold, so the stored fold goes back to what it was, less a manual close, which would
  // outrank the selection.
  const openIndex = (path: string, page: IndexEntry, another: boolean): void => {
    const was = getOwn(folds, path);
    setFolds(({ [path]: _toggled, ...rest }) => (was ? { ...rest, [path]: was } : rest));
    activate(page, another);
  };

  const onAction: TreeProps['onAction'] = (id, mods) => {
    const node = byId.get(id);
    if (node?.kind === 'story') activate(node.entry, mods.shiftKey);
    else if (node?.index) openIndex(node.path, node.index, mods.shiftKey);
  };

  // A breadcrumb asks for a folder; it is shown the way clicking its row shows it, in the Tree view when the
  // current one has no such folder. The row scrolls itself into view once it has rendered.
  const treeEl = useRef<HTMLUListElement>(null);
  const scrollToRow = useRowScroll(treeEl);
  const reveal = (path: string): void => {
    // The current view first; a folder only another view holds switches to it.
    const order = [view, ...VIEWS.map((item) => item.value).filter((v) => v !== view && enabled(v))];
    const found = revealedFolderIn(path, order, nodesOf);
    if (!found) return;
    const { folder } = found;
    if (found.view !== view) setView(found.view);
    setQuery('');
    setFolds((prev) => ({ ...prev, ...Object.fromEntries(folderPathsOf(folder.path).slice(0, -1).map((p) => [p, true])) }));
    scrollToRow(keyOf(folder));
    if (folder.index) openIndex(folder.path, folder.index, false);
    else setFolds((prev) => ({ ...prev, [folder.path]: true }));
  };
  // Resubscribed every commit, so the listener always reads this render's view and data.
  useEffect(() => onRevealInTree(reveal));

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
      <SegmentedBar
        aria-label="Sidebar view"
        variant="flat"
        size="sm"
        items={views}
        value={view}
        onChange={(next) => {
          if (next) setView(next);
        }}
      />
      <LibraryFilter libraries={libraries} hidden={hidden} onHiddenChange={(next) => setHidden((prev) => ({ ...prev, ...next }))} />
      <input
        type="search"
        className="fg-tree__filter"
        aria-label="Filter stories"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <Tree
        ref={treeEl}
        aria-labelledby={headingId}
        className="fg-tree__items"
        nodes={nodes}
        empty={filtering ? 'No stories match' : 'No stories'}
        expandedIds={expanded}
        onExpandedChange={onExpandedChange}
        onAction={onAction}
      />
    </section>
  );
}
