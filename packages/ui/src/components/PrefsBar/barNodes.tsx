import type { ReactNode } from 'react';
import type { IconSpec } from '@weasel-js/icons';
import { isPrefLeaf, prefAliasName, type PrefAlias, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import { resolveIcon } from '../../icons/resolveIcon';
import { BarMenu, type BarMenuSources } from '../Bar/BarMenu';
import { barMenuRoot } from '../Bar/barMenuRoot';
import { BarPopover } from '../Bar/BarPopover';
import { BarDivider, BarItem } from '../Bar/barParts';

/** A leaf in a bar, by the path its surface addresses it at. */
export interface BarLeafNode {
  path: string;
  leaf: PrefLeaf;
  /** Where the leaf's value lives when that is not `path`: the leaf is the one an alias at `path` shows. */
  at?: string;
}

/** A cell a surface drew for one leaf, or for several it fused into one control. */
export interface BarCell {
  /** The path of the leaf the cell stands for: the first, for several. */
  path: string;
  content: ReactNode;
}

/**
 * One thing a schema's bar holds: a leaf, a cell a surface has already drawn, a run of things set off by dividers,
 * or a button that opens what no line holds.
 */
export type BarNode =
  | ({ kind: 'leaf' } & BarLeafNode)
  | ({ kind: 'cell' } & BarCell)
  | { kind: 'run'; path: string; nodes: readonly BarNode[] }
  | { kind: 'opens'; path: string; name: string; icon?: IconSpec; body: () => ReactNode }
  | { kind: 'menu'; path: string; name: string; group: PrefGroup; sources: BarMenuSources };

/** What a bar calls a leaf: its name, and for an alias no surface resolved, what an alias of nothing is called. */
export function barLeafName(leaf: PrefLeaf): string {
  return leaf.kind === 'alias' ? prefAliasName(leaf as PrefAlias) : leaf.name;
}

/**
 * `nodes` with each leaf as `shown` hands it back, in every run: how a surface puts the leaf an alias shows in
 * the alias's place, so the bar names and draws that leaf.
 */
export function shownBarNodes(nodes: readonly BarNode[], shown: (node: BarLeafNode) => BarLeafNode): BarNode[] {
  return nodes.map((node) => {
    if (node.kind === 'leaf') return { kind: 'leaf', ...shown(node) };
    return node.kind === 'run' ? { ...node, nodes: shownBarNodes(node.nodes, shown) } : node;
  });
}

/**
 * A group's children as a bar holds them. A leaf is a cell. A `section`, a nested `bar`, a `fragment`, and a group
 * that says nothing are runs. A `page`, a `tab`, and a `panel` are too much for a line, and open from a button
 * through `open`. A `menu` opens from a button as a menu reading and writing through `menu`, or as `open` does where
 * a surface has no values to hand one.
 */
export function groupBarNodes(
  group: PrefGroup,
  path: string,
  open: (group: PrefGroup, path: string) => ReactNode,
  menu?: BarMenuSources,
): BarNode[] {
  const out: BarNode[] = [];
  for (const [key, child] of Object.entries(group.children)) {
    const at = path === '' ? key : `${path}.${key}`;
    if (isPrefLeaf(child)) {
      if (child.hidden !== true) out.push({ kind: 'leaf', path: at, leaf: child });
    } else if (child.as === 'menu' && menu) {
      out.push({ kind: 'menu', path: at, name: child.name, group: child, sources: menu });
    } else if (opensFromBar(child.as)) {
      out.push({ kind: 'opens', path: at, name: child.name, ...(child.icon ? { icon: child.icon } : {}), body: () => open(child, at) });
    } else {
      out.push({ kind: 'run', path: at, nodes: groupBarNodes(child, at, open, menu) });
    }
  }
  return out;
}

/** True for a group form a bar opens from a button, having no line to draw it on. */
export function opensFromBar(as: string | undefined): boolean {
  return as === 'page' || as === 'tab' || as === 'panel' || as === 'menu';
}

/** How {@link barNodeChildren} draws a bar's nodes. */
export interface BarNodeDraw {
  /** Leaves that sit side by side, as the cells they make. Fewer cells than leaves come back where a surface fuses
   *  neighbors, as a run of flags. */
  cells: (leaves: readonly BarLeafNode[]) => readonly BarCell[];
  /** Attributes for the element drawn for the leaf or group at `path`. */
  attrs?: (path: string, leaf: boolean) => Record<string, string | undefined>;
}

/**
 * `nodes` as a `Bar`'s children: cells in order, a divider on each side of a run, and a button for each group that
 * opens. Each is a `Bar.Item` keyed by its path, in the run it sits in, so a bar given `onReorder` can move it.
 */
export function barNodeChildren(nodes: readonly BarNode[], draw: BarNodeDraw): ReactNode[] {
  const out: ReactNode[] = [];
  const item = (path: string, container: string, leaf: boolean, content: ReactNode, rule?: boolean): void => {
    const attrs = draw.attrs?.(path, leaf);
    out.push(<BarItem key={path} id={path} in={container} {...(rule ? { rule } : {})} {...(attrs ? { attrs } : {})}>{content}</BarItem>);
  };
  const walk = (list: readonly BarNode[], container: string): void => {
    let pending: BarLeafNode[] = [];
    const flush = (): void => {
      for (const cell of draw.cells(pending)) item(cell.path, container, true, cell.content);
      pending = [];
    };
    for (const node of list) {
      if (node.kind === 'leaf' && node.leaf.kind === 'separator') {
        flush();
        item(node.path, container, true, null, true);
      } else if (node.kind === 'leaf') {
        pending.push(node);
      } else {
        flush();
        if (node.kind === 'cell') item(node.path, container, true, node.content);
        else if (node.kind === 'opens') item(node.path, container, false, <BarPopover label={node.name} icon={resolveIcon(node.icon)}>{node.body()}</BarPopover>);
        else if (node.kind === 'menu') {
          const { group, sources } = node;
          item(node.path, container, false, <BarMenu label={node.name} icon={resolveIcon(group.icon)} description={group.description} schema={barMenuRoot(group, node.path)} {...sources} />);
        } else {
          out.push(<BarDivider key={`${node.path}:before`} />);
          walk(node.nodes, node.path);
          out.push(<BarDivider key={`${node.path}:after`} />);
        }
      }
    }
    flush();
  };
  walk(nodes, '');
  return out;
}
