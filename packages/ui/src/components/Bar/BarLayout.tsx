import type { ReactNode } from 'react';
import { isPrefLeaf, prefAliasName, type PrefAlias, type PrefBarOverflow, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import { BarOverflow } from './BarOverflow';
import { BarPopover } from './BarPopover';
import { BAR_ITEM, BAR_MORE, useBarOverflow } from './useBarOverflow';
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
  | { kind: 'opens'; path: string; name: string; body: () => ReactNode };

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
  /** Draw the strip the bar sits on, for a bar set among other things with
   *  no strip of the host's under it. */
  framed?: boolean;
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
  className?: string;
}

type Item = ({ divider: true } | { divider?: false; path: string; leaf: boolean; content: ReactNode }) & { key: string };
type Drawn = { divider: true } | { divider?: false; path: string; leaf: boolean; content: ReactNode };

/**
 * The line a bar's contents sit on, whatever surface drew them: cells in
 * order, a divider on each side of a run, and a button for each group that
 * opens. `Bar` draws a schema through it; a form and a panel draw a group
 * `as: 'bar'` through it with cells of their own.
 *
 * Focus keeps plain tab order. A bar of number boxes and selects has to
 * leave the arrow keys to them, so it does not rove.
 */
export function BarLayout(props: BarLayoutProps) {
  const { nodes, orientation = 'horizontal', cells, row, attrs, rootAttrs, label, framed, className } = props;
  const { overflow = 'scroll', overflowLabel = 'More' } = props;
  const vertical = orientation === 'vertical';
  const items: Drawn[] = [];

  const walk = (list: readonly BarNode[]): void => {
    let pending: BarLeafNode[] = [];
    const flush = (): void => {
      // A vertical bar has no room beside a field, so only a button stays on it.
      const drawn = vertical
        ? pending.flatMap((node): readonly BarCell[] => {
            if (node.leaf.kind === 'action') return cells([node]);
            const body = row(node);
            if (body == null) return [];
            return [{ path: node.path, content: <BarPopover label={barLeafName(node.leaf)}>{body}</BarPopover> }];
          })
        : cells(pending);
      for (const cell of drawn) items.push({ path: cell.path, leaf: true, content: cell.content });
      pending = [];
    };
    for (const node of list) {
      if (node.kind === 'leaf' && node.leaf.kind === 'separator') {
        flush();
        const rule = <span className={s.rule} role="separator" aria-orientation={vertical ? 'horizontal' : 'vertical'} />;
        items.push({ path: node.path, leaf: true, content: rule });
        continue;
      }
      if (node.kind === 'leaf') {
        pending.push(node);
        continue;
      }
      flush();
      if (node.kind === 'cell') {
        items.push({ path: node.path, leaf: true, content: node.content });
        continue;
      }
      if (node.kind === 'opens') {
        items.push({ path: node.path, leaf: false, content: <BarPopover label={node.name}>{node.body()}</BarPopover> });
        continue;
      }
      items.push({ divider: true });
      walk(node.nodes);
      items.push({ divider: true });
    }
    flush();
  };
  walk(nodes);

  // A divider sets two things apart, so none opens or closes the bar and no two meet.
  const shown: Item[] = items
    .filter((item, i) => !item.divider || (i > 0 && i < items.length - 1 && !items[i - 1]!.divider))
    .map((item, i) => ({ ...item, key: item.divider ? `divider:${i}` : item.path }));
  while (shown.at(-1)?.divider) shown.pop();

  const menu = overflow === 'menu';
  const { bar, kept } = useBarOverflow(menu, shown.map((item) => item.key), vertical);
  const line = shown.slice(0, kept);
  while (line.at(-1)?.divider) line.pop();
  const rest = shown.slice(kept);
  while (rest[0]?.divider) rest.shift();

  const draw = (list: readonly Item[], across: boolean): ReactNode =>
    list.map((item) =>
      item.divider ? (
        <span key={item.key} {...{ [BAR_ITEM]: item.key }} className={s.divider} role="separator" aria-orientation={across ? 'horizontal' : 'vertical'} />
      ) : (
        <span key={item.key} {...{ [BAR_ITEM]: item.key }} className={s.cell} {...attrs?.(item.path, item.leaf)}>
          {item.content}
        </span>
      ),
    );

  return (
    <div
      {...rootAttrs}
      ref={bar}
      className={[s.bar, framed && s.framed, className].filter(Boolean).join(' ')}
      data-orientation={orientation}
      data-overflow={menu ? 'menu' : undefined}
      role={label === undefined ? undefined : 'toolbar'}
      aria-label={label}
      aria-orientation={label === undefined ? undefined : orientation}
    >
      {draw(line, vertical)}
      {rest.length > 0 && (
        <span className={s.cell} {...{ [BAR_MORE]: '' }}>
          <BarOverflow label={overflowLabel}>{draw(rest, true)}</BarOverflow>
        </span>
      )}
    </div>
  );
}

/**
 * A group's children as a bar holds them. A leaf is a cell. A `section`, a
 * nested `bar`, a `fragment`, and a group that says nothing are runs. A
 * `page`, a `tab`, and a `panel` are too much for a line, and open from a
 * button through `open`.
 */
export function groupBarNodes(
  group: PrefGroup,
  path: string,
  open: (group: PrefGroup, path: string) => ReactNode,
): BarNode[] {
  const out: BarNode[] = [];
  for (const [key, child] of Object.entries(group.children)) {
    const at = path === '' ? key : `${path}.${key}`;
    if (isPrefLeaf(child)) {
      if (child.hidden !== true) out.push({ kind: 'leaf', path: at, leaf: child });
    } else if (opensFromBar(child.as)) {
      out.push({ kind: 'opens', path: at, name: child.name, body: () => open(child, at) });
    } else {
      out.push({ kind: 'run', path: at, nodes: groupBarNodes(child, at, open) });
    }
  }
  return out;
}

/** True for a group form a bar opens from a button, having no line to draw it on. */
export function opensFromBar(as: string | undefined): boolean {
  return as === 'page' || as === 'tab' || as === 'panel';
}
