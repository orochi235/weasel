import { type LabChromeContext, usePersistedState } from '@weasel-js/labkit';
import { Checkbox } from '@weasel-js/ui/components/Checkbox';
import { ToggleBar, type ToggleBarItem } from '@weasel-js/ui/components/ToggleBar';
import { Tree, type TreeNode as UiTreeNode, type TreeProps } from '@weasel-js/ui/components/Tree';
import { type ReactNode, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { indexEntries } from '../../story/indexPages';
import { isGallery, isLab } from '../../story/tags';
import type { IndexEntry } from '../../story/types';
import { revealTrial } from '../revealTrial';
import { onRevealInTree } from '../treeReveal';
import { useRoute } from '../useRoute';
import { buildTree, filterTree, type TreeNode as StoryNode } from './buildTree';
import { buildComponents, componentNodes, filterComponents, librariesIn } from './buildComponents';
import { LibrariesContext } from '../../story/library';
import { LabBadge } from '../../frame/index/LabBadge';
import { LibraryBadge as PackageBadge } from '../../frame/index/LibraryBadge';

/** Which shape the sidebar lists the index in. */
type View = 'tree' | 'components' | 'gallery';

const VIEWS: readonly ToggleBarItem<View>[] = [
  { value: 'tree', label: 'Tree' },
  { value: 'components', label: 'Components' },
  { value: 'gallery', label: 'Gallery' },
];

export interface StoryTreeProps {
  ctx: LabChromeContext;
  index: readonly IndexEntry[];
}

type StoryFolder = Extract<StoryNode, { kind: 'folder' }>;

const keyOf = (node: StoryNode): string => (node.kind === 'folder' ? `folder:${node.path}` : `story:${node.entry.id}`);
const pathOf = (folderKey: string): string => folderKey.slice('folder:'.length);
const hrefOf = (entry: IndexEntry): string => `#/${encodeURIComponent(entry.id)}`;

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

/** A component's package, as the sidebar tags its rows. */
function LibraryBadge({ library }: { library: string }) {
  return <PackageBadge library={library} className="fg-tree__tag" />;
}

/** What follows a row's label: a Lab badge on a whole screen, then the package. */
function rowTags(lab: boolean, library: string | undefined): ReactNode {
  if (!lab && !library) return undefined;
  return (
    <>
      {lab ? <LabBadge className="fg-tree__lab" /> : null}
      {library ? <LibraryBadge library={library} /> : null}
    </>
  );
}

/** The indexed stories as a filterable tree; opening one runs it in the focused trial, or with Shift in another. */
export function StoryTree({ ctx, index }: StoryTreeProps) {
  const headingId = useId();
  const [route, setRoute] = useRoute();
  const [query, setQuery] = useState('');
  const [folds, setFolds] = usePersistedState<Record<string, boolean>>('fg-tree-open', {}, { scope: 'lab' });
  const [chosen, setView] = usePersistedState<View>('fg-tree-view', 'components', { scope: 'lab' });
  // Stored as what is *off*, so a library added later is on without anyone
  // going back to tick it.
  const [hidden, setHidden] = usePersistedState<Record<string, boolean>>('fg-tree-libraries', {}, { scope: 'lab' });

  const table = useContext(LibrariesContext);
  const libraries = useMemo(() => librariesIn(index, table), [index, table]);
  // A view is grayed out by what the project has, not by the package filter,
  // which would otherwise disable a view as a side effect of unticking a box.
  const views = useMemo(() => {
    const hasGallery = index.some(isGallery);
    const hasOther = index.some((entry) => !isGallery(entry));
    return VIEWS.map((item) => ({ ...item, disabled: item.value === 'gallery' ? !hasGallery : !hasOther }));
  }, [index]);
  // The stored choice is kept, so a view comes back once it has something in it.
  const enabled = (value: View): boolean => views.some((item) => item.value === value && !item.disabled);
  const view = [chosen, 'components' as const, 'gallery' as const].find(enabled) ?? chosen;
  // The package filter runs on the index, so it means the same thing in both
  // views rather than once per view's own grouping.
  const kept = useMemo(() => index.filter((entry) => !hidden[table.of(entry)]), [index, hidden, table]);
  // Galleries list only in their own view, grouped the way Components groups.
  const [galleryEntries, rest] = useMemo(() => {
    const yes: IndexEntry[] = [];
    const no: IndexEntry[] = [];
    for (const entry of kept) (isGallery(entry) ? yes : no).push(entry);
    return [yes, no];
  }, [kept]);
  const tree = useMemo(() => buildTree(rest), [rest]);
  const components = useMemo(() => buildComponents(rest, table), [rest, table]);
  const galleries = useMemo(() => buildComponents(galleryEntries, table), [galleryEntries, table]);
  const shown = useMemo(
    () =>
      view === 'tree'
        ? filterTree(tree, query)
        : componentNodes(filterComponents(view === 'gallery' ? galleries : components, query)),
    [view, components, galleries, tree, query],
  );
  const routable = useMemo(() => [...kept, ...indexEntries(kept)], [kept]);
  const routed = routable.find((entry) => entry.id === route);
  const routeAncestors = useMemo(() => ancestorsOf(routed), [routed]);
  const filtering = query.trim() !== '';
  const openKey = ctx.trials.map((trial) => trial.instrumentName).join('\n');
  const openIds = useMemo(() => new Set(openKey.split('\n')), [openKey]);

  const { nodes, byId, folders: folderIds } = useMemo(() => {
    const ids = new Map<string, StoryNode>();
    const folders: string[] = [];
    const convert = (list: readonly StoryNode[]): UiTreeNode[] =>
      list.map((node) => {
        const id = keyOf(node);
        ids.set(id, node);
        if (node.kind === 'folder') {
          folders.push(id);
          return {
            id,
            label: node.label,
            className: 'fg-tree__folder',
            href: node.index ? hrefOf(node.index) : undefined,
            current: !!node.index && openIds.has(node.index.id),
            trailing: rowTags(!!node.index && isLab(node.index), node.tag),
            children: convert(node.children),
          };
        }
        return {
          id,
          label: node.label ?? node.entry.name,
          className: 'fg-tree__story',
          href: hrefOf(node.entry),
          current: openIds.has(node.entry.id),
          trailing: rowTags(isLab(node.entry), node.tag),
        };
      });
    return { nodes: convert(shown), byId: ids, folders };
  }, [shown, openIds]);
  const expanded = useMemo(
    () => new Set(folderIds.filter((id) => filtering || (folds[pathOf(id)] ?? routeAncestors.has(pathOf(id))))),
    [folderIds, filtering, folds, routeAncestors],
  );

  // A filter forces every folder open, so a toggle then would change state nobody can see.
  const onExpandedChange = (next: Set<string>): void => {
    if (filtering) return;
    const changed = folderIds.filter((id) => next.has(id) !== expanded.has(id));
    if (changed.length) setFolds((prev) => ({ ...prev, ...Object.fromEntries(changed.map((id) => [pathOf(id), next.has(id)])) }));
  };

  const activate = (entry: IndexEntry, another: boolean): void => {
    const focused = ctx.trials.find((trial) => trial.id === ctx.focusedTrialId);
    if (another || !focused) ctx.addTrial(entry.id);
    else if (focused.instrumentName === entry.id) {
      // The URL may name another story, or none; the trial's knobs stand, or the route would read as "no knobs set".
      revealTrial(focused.id);
      setRoute(entry.id, { fromTrial: true });
      return;
    } else {
      ctx.swapTrial(focused.id, entry.id);
      setRoute(entry.id, { inPlace: true });
      return;
    }
    setRoute(entry.id);
  };

  // A component's row opens its index page, which opens its folder; only the fold mark folds it. Selection opens
  // it, and closes it again once the selection moves on; only a manual fold is stored. The row's activation has
  // already toggled the fold, so the stored fold goes back to what it was, less a manual close, which would
  // outrank the selection.
  const openIndex = (path: string, page: IndexEntry, another: boolean): void => {
    const was = folds[path];
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
  const scrollTo = useRef<string | null>(null);
  useEffect(() => {
    const id = scrollTo.current;
    if (id == null) return;
    const row = [...(treeEl.current?.querySelectorAll<HTMLElement>('[data-tree-id]') ?? [])].find((el) => el.dataset.treeId === id);
    if (!row) return;
    scrollTo.current = null;
    (row.firstElementChild as HTMLElement | null)?.scrollIntoView({ block: 'nearest' });
  });
  const reveal = (path: string): void => {
    const find = (list: readonly StoryNode[], at: string): StoryFolder | undefined => {
      for (const node of list) {
        if (node.kind !== 'folder') continue;
        if (node.path === at) return node;
        const inner = find(node.children, at);
        if (inner) return inner;
      }
      return undefined;
    };
    const nodesOf = (v: View): readonly StoryNode[] =>
      v === 'tree' ? tree : componentNodes(v === 'gallery' ? galleries : components);
    // The current view first; a folder only another view holds switches to it; failing all three, the nearest folder above.
    const order = [view, ...VIEWS.map((item) => item.value).filter((v) => v !== view && enabled(v))];
    let node: StoryFolder | undefined;
    let where: View = view;
    for (let at = path; at && !node; at = at.includes('/') ? at.slice(0, at.lastIndexOf('/')) : '') {
      for (const v of order) {
        node = find(nodesOf(v), at);
        if (node) {
          where = v;
          break;
        }
      }
    }
    const found = node;
    if (!found) return;
    if (where !== view) setView(where);
    setQuery('');
    const segments = found.path.split('/');
    const above = segments.slice(0, -1).map((_, i) => segments.slice(0, i + 1).join('/'));
    setFolds((prev) => ({ ...prev, ...Object.fromEntries(above.map((p) => [p, true])) }));
    scrollTo.current = keyOf(found);
    if (found.index) openIndex(found.path, found.index, false);
    else setFolds((prev) => ({ ...prev, [found.path]: true }));
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
      <ToggleBar
        ariaLabel="Sidebar view"
        variant="flat"
        size="sm"
        items={views}
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
            <span className="fg-tree__library">
              <LibraryBadge library={library} />
            </span>
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
