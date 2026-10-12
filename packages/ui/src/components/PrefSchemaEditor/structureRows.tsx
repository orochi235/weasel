import type { ReactNode } from 'react';
import { isPrefLeaf, isPrefSection, type PrefAlias } from '@weasel-js/prefs';
import { Icon } from '../../icons';
import { Badge } from '../Badge';
import { PrefKindBadge } from '../Prefs/PrefKindBadge';
import type { TreeNode } from '../Tree';
import { GROUP_ICON } from './Palette';
import { drawnLeaf } from './pointers';
import { childrenOf, joinPath, type SchemaNode, type SchemaRoot } from './schemaEdit';
import s from './PrefSchemaEditor.module.css';

/** How many leaves `nodes` come to, counting those under each at any depth. */
function leafCount(nodes: readonly SchemaNode[]): number {
  return nodes.reduce((n, node) => n + (isPrefLeaf(node) ? 1 : leafCount(Object.values(childrenOf(node) ?? {}))), 0);
}

/** A row's label for a node: its name before its key, and an unnamed node's key alone. */
export const nodeLabel = (name: string, key: string): ReactNode => (name ? <>{name} <span className={s.treeKey}>({key})</span></> : key);

const countBadge = (n: number) => <Badge size="xs" status="muted" variant="subtle" className={s.treeCount}>{n}</Badge>;

/** The structure tree's rows for what `node` holds: each child's name before its key, a group's glyph and count, a leaf's kind, and the host's mark. `over` is the dialog a layout's pointers name settings in. */
export function toTreeNodes(node: SchemaNode, path: string | null, changed: ReadonlySet<string>, mark?: (path: string) => ReactNode, over?: SchemaRoot): TreeNode[] {
  return Object.entries(childrenOf(node) ?? {}).map(([key, child]) => {
    const p = joinPath(path, key);
    const kids = childrenOf(child);
    // A layout's pointer reads as the setting it points at, and one that points at none as its key.
    const name = (over && isPrefLeaf(child) && child.kind === 'alias' ? drawnLeaf(over, child as PrefAlias)?.name : undefined) ?? child.name;
    const label = nodeLabel(name, key);
    return {
      id: p,
      label: changed.has(p) ? <span className={s.changed}>{label}</span> : label,
      textValue: name ? `${name} ${key}` : key,
      ...(child.description ? { tooltip: child.description } : {}),
      // Unset, a group is drawn by its depth: a page under the root, a section below that.
      ...(isPrefLeaf(child) ? {} : { leading: <Icon size={16} name={GROUP_ICON[child.as ?? (path === null && !isPrefSection(child) ? 'page' : 'section')]} /> }),
      trailing: isPrefLeaf(child)
        ? <>{mark?.(p)}<PrefKindBadge kind={child.type ?? child.kind} /></>
        // Its glyph says how a group is drawn, so it carries no badge to say it again.
        : <>{mark?.(p)}{countBadge(leafCount([child]))}</>,
      ...(kids ? { children: toTreeNodes(child, p, changed, mark, over) } : {}),
    };
  });
}
