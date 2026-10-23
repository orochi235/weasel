import type { ReactNode } from 'react';
import type { IconRef } from '@weasel-js/icons';
import { isPrefLeaf, prefAliasName, type PrefAlias, type PrefBarLead, type PrefBarOverflow, type PrefGroup, type PrefLeaf, type PrefOrder } from '@weasel-js/prefs';
import type { TrackShape } from '@weasel-js/geom';
import { useTrackShape, type RunAlign } from '../Along/alongContext';
import type { BarMenuSources } from './BarMenu';
import { BarAlong } from './BarAlong';
import { barItems, barLead, drawBarItem, inBarMenu, splitBarItems } from './barItems';
import { BarMarkContext } from './barOrder';
import { BarOverflow } from './BarOverflow';
import { useBarReorder } from './useBarReorder';
import { useBarReorderKeys } from './useBarReorderKeys';
import { BAR_MORE, useBarOverflow } from './useBarOverflow';
import { useBarLead } from './barLeadHandle';
import s from './Bar.module.css';

/** Which way a bar runs. */
export type BarOrientation = 'horizontal' | 'vertical';

/** What a bar does with cells its line has no room for. */
export type BarOverflowMode = PrefBarOverflow;

/** A leaf in a bar, by the path its surface addresses it at. */
export interface BarLeafNode {
  path: string;
  leaf: PrefLeaf;
  /** Where the leaf's value lives when that is not `path`: the leaf is the one an alias at `path` shows. */
  at?: string;
}

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
 * One thing a bar holds: a leaf, a cell a surface has already drawn, a run of
 * things set off by dividers, or a button that opens what no line holds.
 */
export type BarNode =
  | ({ kind: 'leaf' } & BarLeafNode)
  | ({ kind: 'cell' } & BarCell)
  | { kind: 'run'; path: string; nodes: readonly BarNode[] }
  | { kind: 'opens'; path: string; name: string; icon?: IconRef; body: () => ReactNode }
  | { kind: 'menu'; path: string; name: string; group: PrefGroup; sources: BarMenuSources };

/** A cell a surface drew for one leaf, or for several it fused into one control. */
export interface BarCell {
  /** The path of the leaf the cell stands for: the first, for several. */
  path: string;
  content: ReactNode;
}

/** Props for {@link BarLayout}. */
export interface BarLayoutProps {
  nodes: readonly BarNode[];
  orientation?: BarOrientation;
  /** Leaves that sit side by side, as the cells they make. Fewer cells than
   *  leaves come back where a surface fuses neighbors, as a run of flags. */
  cells: (leaves: readonly BarLeafNode[]) => readonly BarCell[];
  /** A leaf as a labeled row, which a vertical bar opens from a button. */
  row: (leaf: BarLeafNode) => ReactNode;
  /** Attributes for the element drawn for the leaf or group at `path`. */
  attrs?: (path: string, leaf: boolean) => Record<string, string | undefined>;
  /** Attributes for the bar's own element. */
  rootAttrs?: Record<string, string | undefined>;
  /** Names the bar, and makes it a `toolbar`. Leave unset inside one. */
  label?: string;
  /** What the line starts with: `'label'` shows `label` ahead of the cells, and `'icon'` shows `icon`. Unset: the
   *  first cell. */
  lead?: PrefBarLead;
  /** The glyph naming the bar, which `lead: 'icon'` starts its line with. */
  icon?: IconRef;
  /** Draw the strip the bar sits on, for a bar set among other things with
   *  no strip of the host's under it. `'segmented'` is a compact strip with
   *  the cells almost touching. */
  framed?: boolean | 'segmented';
  /**
   * What happens to cells the line has no room for. `'scroll'` keeps every
   * cell on the line, which a framed bar scrolls. `'menu'` keeps the cells
   * that fit, in order from the first, and opens the rest from a button at
   * the end of the line, one under another in the forms they have on it. A
   * bar set to `'menu'` takes all the room its host has along the line, so
   * that it can tell when a cell fits again. Default `'scroll'`.
   */
  overflow?: BarOverflowMode;
  /** What the button that opens the rest is called. Default `'More'`. */
  overflowLabel?: string;
  /** A track shape to lay the items along. A curved one places each item on it, tipped, and opens every leaf
   *  but an action from a button; a line keeps the flex line. Default: the nearest `Along`'s shape, else none. */
  shape?: TrackShape;
  /** Where a run shorter than its shape sits. Default: the nearest `Along`'s, else `'center'`. */
  align?: RunAlign;
  /** The order the nodes are drawn in, which a reorder starts from. */
  order?: PrefOrder;
  /** Given, each item and each `actions` button is marked with `data-bar-unit` and `data-bar-in`, and a Cmd-drag
   *  (Ctrl-drag off Apple platforms) moves one among its container's, calling this with the order it settles on. */
  onReorder?: (order: PrefOrder) => void;
  /** Every child key of the container at a path, hidden and overflowed children included, so a reorder keeps the
   *  places of children the bar does not draw. Unset, or undefined for a path, the drawn units are the whole list. */
  keysOf?: (container: string) => readonly string[] | undefined;
  className?: string;
}

/**
 * The line a bar's contents sit on, whatever surface drew them: cells in
 * order, a divider on each side of a run, and a button for each group that
 * opens. `Bar` draws a schema through it; a form and a panel draw a group
 * `as: 'bar'` through it with cells of their own. Given a curved shape, or
 * inside an `Along`, its items lie along that shape instead.
 *
 * Focus keeps plain tab order. A bar of number boxes and selects has to
 * leave the arrow keys to them, so it does not rove.
 */
export function BarLayout(props: BarLayoutProps) {
  const along = useTrackShape();
  const shape = props.shape ?? along?.shape;
  const bar = shape !== undefined && shape.kind !== 'line' ? <BarAlong {...props} shape={shape} align={props.align ?? along?.align ?? 'center'} /> : <BarLine {...props} />;
  return <BarMarkContext.Provider value={props.onReorder !== undefined}>{bar}</BarMarkContext.Provider>;
}

function BarLine(props: BarLayoutProps) {
  const { nodes, orientation = 'horizontal', cells, row, attrs, rootAttrs, label, lead, icon, framed, className } = props;
  const { overflow = 'scroll', overflowLabel = 'More' } = props;
  const vertical = orientation === 'vertical';
  // A vertical bar has no room beside a field, so only a button stays on it.
  const shown = barItems(nodes, { popLeaves: vertical, cells, row, mark: props.onReorder !== undefined });
  const leading = useBarLead(barLead(lead, label, icon));

  const menu = overflow === 'menu';
  const { bar, kept } = useBarOverflow(menu, shown.map((item) => item.key), vertical);
  const { line, rest } = splitBarItems(shown, kept);
  const reorder = useBarReorder({ root: bar, order: props.order, onReorder: props.onReorder, keysOf: props.keysOf, measure: (_, p) => (vertical ? p.clientY : p.clientX) });
  const keys = useBarReorderKeys({ root: bar, order: props.order, onReorder: props.onReorder, keysOf: props.keysOf, vertical });

  return (
    <div
      {...rootAttrs}
      ref={bar}
      onPointerDownCapture={reorder.onPointerDownCapture}
      onKeyDownCapture={keys.onKeyDownCapture}
      className={[s.bar, framed === 'segmented' ? s.segmented : framed && s.framed, className].filter(Boolean).join(' ')}
      data-orientation={orientation}
      data-overflow={menu ? 'menu' : undefined}
      role={label === undefined ? undefined : 'toolbar'}
      aria-label={label}
      aria-orientation={label === undefined ? undefined : orientation}
    >
      {props.onReorder && <span role="status" className={s.status}>{keys.announcement}</span>}
      {leading && <span className={s.lead} {...leading.attrs}>{leading.content}</span>}
      {line.map((item) => drawBarItem(item, vertical, attrs))}
      {rest.length > 0 && (
        <span className={s.cell} {...{ [BAR_MORE]: '' }}>
          <BarOverflow label={overflowLabel}>{rest.map((item) => drawBarItem(inBarMenu(item), true, attrs))}</BarOverflow>
        </span>
      )}
    </div>
  );
}

/**
 * A group's children as a bar holds them. A leaf is a cell. A `section`, a
 * nested `bar`, a `fragment`, and a group that says nothing are runs. A
 * `page`, a `tab`, and a `panel` are too much for a line, and open from a
 * button through `open`. A `menu` opens from a button as a menu reading and
 * writing through `menu`, or as `open` does where a surface has no values to hand one.
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
