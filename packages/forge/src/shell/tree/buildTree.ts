import { indexEntries } from '../../story/indexPages';
import { isGallery } from '../../story/tags';
import type { IndexEntry } from '../../story/types';

export type TreeNode =
  | { kind: 'folder'; label: string; path: string; children: TreeNode[]; tag?: string; index?: IndexEntry }
  | { kind: 'story'; entry: IndexEntry; tag?: string; label?: string };

type Folder = Extract<TreeNode, { kind: 'folder' }>;

function sortFolder(nodes: TreeNode[]): TreeNode[] {
  const folders = nodes.filter((n): n is Folder => n.kind === 'folder');
  folders.sort((a, b) => a.label.localeCompare(b.label));
  for (const folder of folders) folder.children = sortFolder(folder.children);
  return [...folders, ...nodes.filter((n) => n.kind === 'story')];
}

/**
 * `nodes` with every folder that holds nothing but a gallery replaced by that gallery under the folder's name, so a
 * gallery titled `ui/Cursors/Gallery` lists as `Cursors` with its stories directly beneath it. The gallery keeps its
 * own path and index page, so its route and story ids are unchanged.
 */
export function foldGalleries(nodes: TreeNode[]): TreeNode[] {
  return nodes.map((node) => {
    if (node.kind !== 'folder') return node;
    const children = foldGalleries(node.children);
    const [only] = children;
    // Only a gallery one segment down: one already folded would carry this folder off and lose its name.
    if (
      !node.index
      && children.length === 1
      && only?.kind === 'folder'
      && only.path === `${node.path}/${only.label}`
      && only.index
      && isGallery(only.index)
    ) {
      return { ...only, label: node.label, tag: node.tag ?? only.tag };
    }
    return { ...node, children };
  });
}

/**
 * Story titles as nested folders, split on `/`; the last segment is the component, which carries its index page and
 * holds its subfolders, then its stories. A folder holding only a gallery is folded into it (see `foldGalleries`).
 */
export function buildTree(index: readonly IndexEntry[]): TreeNode[] {
  const root: TreeNode[] = [];
  const folders = new Map<string, Folder>();
  const pages = new Map(indexEntries(index).map((page) => [page.title, page]));
  for (const entry of index) {
    let siblings = root;
    let path = '';
    for (const label of entry.title.split('/')) {
      path = path ? `${path}/${label}` : label;
      let folder = folders.get(path);
      if (!folder) {
        const page = pages.get(path);
        folder = { kind: 'folder', label, path, children: [], ...(page ? { index: page } : {}) };
        folders.set(path, folder);
        siblings.push(folder);
      }
      siblings = folder.children;
    }
    siblings.push({ kind: 'story', entry });
  }
  return foldGalleries(sortFolder(root));
}

/**
 * The stories whose `title/name` contains `query`, ignoring case, with their ancestors. A folder keeps its index
 * page only when its own path matches.
 */
export function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return nodes;
  const walk = (list: TreeNode[]): TreeNode[] =>
    list.flatMap((node): TreeNode[] => {
      if (node.kind === 'story') {
        return `${node.entry.title}/${node.entry.name}`.toLowerCase().includes(needle) ? [node] : [];
      }
      const children = walk(node.children);
      if (children.length === 0) return [];
      const { index: page, ...folder } = node;
      return [page && node.path.toLowerCase().includes(needle) ? { ...folder, children, index: page } : { ...folder, children }];
    });
  return walk(nodes);
}
