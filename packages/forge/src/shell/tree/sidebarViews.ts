import type { SegmentedBarItem } from '@weasel-js/ui/components/Segmented';
import { getOwn } from '@weasel-js/registry';
import { useMemo } from 'react';
import type { Libraries } from '../../story/library';
import { isGallery } from '../../story/tags';
import type { IndexEntry } from '../../story/types';
import { buildTree, type TreeNode as StoryNode } from './buildTree';
import { buildComponents, componentNodes, type ComponentRow } from './buildComponents';

/** Which shape the sidebar lists the index in. */
export type View = 'tree' | 'components' | 'gallery';

export const VIEWS: readonly SegmentedBarItem<View>[] = [
  { value: 'tree', label: 'Tree' },
  { value: 'components', label: 'Components' },
  { value: 'gallery', label: 'Gallery' },
];

/** The index as each of the sidebar's views lists it, and which views have anything to list. */
export interface SidebarViews {
  /** The view switch's items, a view with nothing in the project disabled. */
  readonly views: readonly (SegmentedBarItem<View> & { disabled: boolean })[];
  /** The view shown: the chosen one while it has anything, otherwise the first that does. */
  readonly view: View;
  enabled(view: View): boolean;
  readonly tree: StoryNode[];
  readonly components: ComponentRow[];
  readonly galleries: ComponentRow[];
  /** A view's nodes, unfiltered. */
  nodesOf(view: View): readonly StoryNode[];
}

/** The sidebar's views of `index`, less the packages `hidden` turns off, with `chosen` shown when it can be. */
export function useSidebarViews(
  index: readonly IndexEntry[],
  table: Libraries,
  hidden: Readonly<Record<string, boolean>>,
  chosen: View,
): SidebarViews {
  // A view is grayed out by what the project has, not by the package filter,
  // which would otherwise disable a view as a side effect of turning a package off.
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
  const kept = useMemo(() => index.filter((entry) => !getOwn(hidden, table.of(entry))), [index, hidden, table]);
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
  const nodesOf = (v: View): readonly StoryNode[] => (v === 'tree' ? tree : componentNodes(v === 'gallery' ? galleries : components));
  return { views, view, enabled, tree, components, galleries, nodesOf };
}
