import type { TreeNode as UiTreeNode } from '@weasel-js/ui/components/Tree';
import type { ReactNode } from 'react';
import { LabBadge } from '../../frame/index/LabBadge';
import { LibraryBadge as PackageBadge } from '../../frame/index/LibraryBadge';
import { formatRoute } from '../../route/url';
import { isLab } from '../../story/tags';
import type { IndexEntry } from '../../story/types';
import type { TreeNode as StoryNode } from './buildTree';

export type StoryFolder = Extract<StoryNode, { kind: 'folder' }>;

/** A sidebar node's row id, before numbering apart from a row that shares it. */
export const keyOf = (node: StoryNode): string => (node.kind === 'folder' ? `folder:${node.path}` : `story:${node.entry.id}`);

/** `node`'s key, numbered past those `ids` holds: folders of two libraries can share a path in the components view. */
function freshKey(node: StoryNode, ids: ReadonlyMap<string, unknown>): string {
  let id = keyOf(node);
  for (let n = 2; ids.has(id); n++) id = `${keyOf(node)}#${n}`;
  return id;
}
const hrefOf = (entry: IndexEntry): string => formatRoute({ story: entry.id, params: {} });

/** A component's package, as the sidebar tags its rows. */
export function LibraryBadge({ library }: { library: string }) {
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

/** The sidebar's rows for `shown`: each row, the node behind each row id, and the ids of the folder rows. */
export interface TreeRows {
  readonly nodes: UiTreeNode[];
  readonly byId: ReadonlyMap<string, StoryNode>;
  readonly folders: readonly string[];
}

/** The rows the sidebar's tree draws for `shown`, marking current those whose story `openIds` holds. */
export function treeRowsFor(shown: readonly StoryNode[], openIds: ReadonlySet<string>): TreeRows {
  const ids = new Map<string, StoryNode>();
  const folders: string[] = [];
  const convert = (list: readonly StoryNode[]): UiTreeNode[] =>
    list.map((node) => {
      const id = freshKey(node, ids);
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
}
