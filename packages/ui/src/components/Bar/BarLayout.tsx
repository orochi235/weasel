import type { ReactNode } from 'react';
import { isPrefLeaf, type PrefGroup, type PrefLeaf } from '@weasel-js/prefs';
import { BarPopover } from './BarPopover';
import s from './Bar.module.css';

/** Which way a bar runs. */
export type BarOrientation = 'horizontal' | 'vertical';

/** A leaf in a bar, by the path its surface addresses it at. */
export interface BarLeafNode {
  path: string;
  leaf: PrefLeaf;
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
  className?: string;
}

type Item = { divider: true } | { divider?: false; path: string; leaf: boolean; content: ReactNode };

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
  const vertical = orientation === 'vertical';
  const items: Item[] = [];

  const walk = (list: readonly BarNode[]): void => {
    let pending: BarLeafNode[] = [];
    const flush = (): void => {
      // A vertical bar has no room beside a field, so only a button stays on it.
      const drawn = vertical
        ? pending.flatMap((node): readonly BarCell[] => {
            if (node.leaf.kind === 'action') return cells([node]);
            const body = row(node);
            if (body == null) return [];
            return [{ path: node.path, content: <BarPopover label={node.leaf.name}>{body}</BarPopover> }];
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
  const shown = items.filter(
    (item, i) => !item.divider || (i > 0 && i < items.length - 1 && !items[i - 1]!.divider),
  );
  while (shown.at(-1)?.divider) shown.pop();

  return (
    <div
      {...rootAttrs}
      className={[s.bar, framed && s.framed, className].filter(Boolean).join(' ')}
      data-orientation={orientation}
      role={label === undefined ? undefined : 'toolbar'}
      aria-label={label}
      aria-orientation={label === undefined ? undefined : orientation}
    >
      {shown.map((item, i) =>
        item.divider ? (
          <span key={`divider:${i}`} className={s.divider} role="separator" aria-orientation={vertical ? 'horizontal' : 'vertical'} />
        ) : (
          <span key={item.path} className={s.cell} {...attrs?.(item.path, item.leaf)}>
            {item.content}
          </span>
        ),
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
