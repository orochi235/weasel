import type { ReactNode } from 'react';
import { isPrefLeaf, type PrefActions, type PrefAlias, type PrefLeaf } from '@weasel-js/prefs';
import { Badge } from '../Badge';
import { PrefKindBadge } from '../Prefs/PrefKindBadge';
import type { TreeNode } from '../Tree';
import { nodeIcon } from './nodeIcon';
import type { EditorAction } from './editorActions';
import { drawnLeaf } from './pointers';
import { childrenOf, joinPath, type SchemaNode, type SchemaRoot } from './schemaEdit';
import { soughtRow } from './rowSearch';
import s from './PrefSchemaEditor.module.css';

/** The actions an `actions` leaf draws, of `actions`. */
const drawnBy = (leaf: PrefActions, actions: readonly EditorAction[]): EditorAction[] => actions.filter((a) => a.group === leaf.group);

/** Whether `node` is an `actions` leaf, which the tree draws as a grouping of the actions it draws. */
const isActionsLeaf = (node: SchemaNode): node is PrefActions => isPrefLeaf(node) && node.kind === 'actions';

/** How many leaves `nodes` come to, counting those under each at any depth, and an `actions` leaf as the actions it
 *  draws where `actions` says which. */
function leafCount(nodes: readonly SchemaNode[], actions?: readonly EditorAction[]): number {
  return nodes.reduce((n, node) => {
    if (actions && isActionsLeaf(node)) return n + drawnBy(node, actions).length;
    return n + (isPrefLeaf(node) ? 1 : leafCount(Object.values(childrenOf(node) ?? {}), actions));
  }, 0);
}

/** A row's label for a node: its name before its key, and an unnamed node's key alone. */
export const nodeLabel = (name: string, key: string): ReactNode => (name ? <>{name} <span className={s.treeKey}>{key}</span></> : key);

/** A leaf's label: a row with no glyph before it, set in from where one would be and in the plain weight. */
export const leafLabel = (label: ReactNode): ReactNode => <span className={s.treeLeaf}>{label}</span>;

const countBadge = (n: number) => <Badge size="xs" emphasis="low" variant="subtle" className={s.treeCount}>{n}</Badge>;

/** The actions an `actions` leaf draws, each a row under it that names one and takes no edit: the leaf holds none
 *  of them, so they are shown and never selected. */
function drawnActionRows(path: string, leaf: PrefActions, actions: readonly EditorAction[]): TreeNode[] {
  return drawnBy(leaf, actions).map((a) => soughtRow({
    id: `${path}${DRAWN_ACTION}${a.key}`,
    label: leafLabel(nodeLabel(a.label, a.key)),
    ...(a.icon ? { leading: a.icon } : {}),
    disabled: true,
  }, { text: [a.label, a.key], tags: a.tags }));
}

/** Sets a drawn action's row id apart from every tree path, which holds no `#`. */
const DRAWN_ACTION = '#';

/** The structure tree's rows for what `node` holds: each child's name before its key, a group's glyph and count, a leaf's kind, and the host's mark. `over` is the dialog a layout's pointers name settings in. An `actions` leaf holds a row for each of `actions` it draws. */
export function toTreeNodes(node: SchemaNode, path: string | null, changed: ReadonlySet<string>, mark?: (path: string) => ReactNode, over?: SchemaRoot, actions?: readonly EditorAction[]): TreeNode[] {
  return Object.entries(childrenOf(node) ?? {}).map(([key, child]) => {
    const p = joinPath(path, key);
    const kids = childrenOf(child);
    // A layout's pointer reads as the setting it points at, and one that points at none as its key.
    const drawn = over && isPrefLeaf(child) && child.kind === 'alias' ? drawnLeaf(over, child as PrefAlias) : undefined;
    const name = drawn?.name ?? child.name;
    const named = nodeLabel(name, key);
    const label = changed.has(p) ? <span className={s.changed}>{named}</span> : named;
    const run = actions && isActionsLeaf(child) ? drawnActionRows(p, child, actions) : undefined;
    const glyph = run || !isPrefLeaf(child) ? nodeIcon(child, path === null) : null;
    return soughtRow({
      id: p,
      label: glyph ? label : leafLabel(label),
      ...(child.description ? { tooltip: child.description } : {}),
      ...(glyph ? { leading: glyph } : {}),
      trailing: glyph
        // Its glyph says how a grouping is drawn, so it carries no badge to say it again.
        ? <>{mark?.(p)}{countBadge(leafCount([child], actions))}</>
        : <>{mark?.(p)}<PrefKindBadge kind={(child as PrefLeaf).type ?? (child as PrefLeaf).kind} /></>,
      ...(kids ? { children: toTreeNodes(child, p, changed, mark, over, actions) } : {}),
      ...(run ? { children: run } : {}),
    }, { text: [name, key], tags: drawn?.tags ?? child.tags });
  });
}
