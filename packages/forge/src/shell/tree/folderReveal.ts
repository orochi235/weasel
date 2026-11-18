import { type RefObject, useCallback, useEffect, useRef } from 'react';
import type { TreeNode as StoryNode } from './buildTree';
import type { StoryFolder } from './treeRows';

/** The path of every folder down to `path`'s, its own last: `a/b` gives `a` and `a/b`. */
export function folderPathsOf(path: string): string[] {
  const segments = path.split('/');
  return segments.map((_, i) => segments.slice(0, i + 1).join('/'));
}

/** The folder at `path` in `list` or below it. */
function folderAt(list: readonly StoryNode[], path: string): StoryFolder | undefined {
  for (const node of list) {
    if (node.kind !== 'folder') continue;
    if (node.path === path) return node;
    const inner = folderAt(node.children, path);
    if (inner) return inner;
  }
  return undefined;
}

/**
 * The folder a reveal of `path` shows, and the view it is in: the first of `order` holding the path, failing all of
 * them the nearest folder above it.
 */
export function revealedFolderIn<V>(
  path: string,
  order: readonly V[],
  nodesOf: (view: V) => readonly StoryNode[],
): { folder: StoryFolder; view: V } | undefined {
  for (let at = path; at; at = at.includes('/') ? at.slice(0, at.lastIndexOf('/')) : '') {
    for (const view of order) {
      const folder = folderAt(nodesOf(view), at);
      if (folder) return { folder, view };
    }
  }
  return undefined;
}

/**
 * Returns a function asking for a row of `tree` by id, which is scrolled into view once it has rendered. Checked
 * after every commit, since the row may take more than one to appear.
 */
export function useRowScroll(tree: RefObject<HTMLElement | null>): (id: string) => void {
  const scrollTo = useRef<string | null>(null);
  useEffect(() => {
    const id = scrollTo.current;
    if (id == null) return;
    const row = [...(tree.current?.querySelectorAll<HTMLElement>('[data-tree-id]') ?? [])].find((el) => el.dataset.treeId === id);
    if (!row) return;
    scrollTo.current = null;
    (row.firstElementChild as HTMLElement | null)?.scrollIntoView({ block: 'nearest' });
  });
  return useCallback((id: string) => {
    scrollTo.current = id;
  }, []);
}
