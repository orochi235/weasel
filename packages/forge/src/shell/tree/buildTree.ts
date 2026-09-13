import type { IndexEntry } from '../../story/types';

export type TreeNode =
  | { kind: 'folder'; label: string; path: string; children: TreeNode[] }
  | { kind: 'story'; entry: IndexEntry };

type Folder = Extract<TreeNode, { kind: 'folder' }>;

function sortFolder(nodes: TreeNode[]): TreeNode[] {
  const folders = nodes.filter((n): n is Folder => n.kind === 'folder');
  const stories = nodes.filter((n) => n.kind === 'story');
  folders.sort((a, b) => a.label.localeCompare(b.label));
  for (const folder of folders) folder.children = sortFolder(folder.children);
  return [...folders, ...stories];
}

/** Story titles as nested folders, split on `/`; the last segment is the component holding its stories. */
export function buildTree(index: readonly IndexEntry[]): TreeNode[] {
  const root: TreeNode[] = [];
  const folders = new Map<string, Folder>();
  for (const entry of index) {
    let siblings = root;
    let path = '';
    for (const label of entry.title.split('/')) {
      path = path ? `${path}/${label}` : label;
      let folder = folders.get(path);
      if (!folder) {
        folder = { kind: 'folder', label, path, children: [] };
        folders.set(path, folder);
        siblings.push(folder);
      }
      siblings = folder.children;
    }
    siblings.push({ kind: 'story', entry });
  }
  return sortFolder(root);
}

/** The stories whose `title/name` contains `query`, ignoring case, with their ancestors. */
export function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return nodes;
  const walk = (list: TreeNode[]): TreeNode[] =>
    list.flatMap((node): TreeNode[] => {
      if (node.kind === 'story') {
        return `${node.entry.title}/${node.entry.name}`.toLowerCase().includes(needle) ? [node] : [];
      }
      const children = walk(node.children);
      return children.length > 0 ? [{ ...node, children }] : [];
    });
  return walk(nodes);
}
