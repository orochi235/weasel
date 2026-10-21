import type { CSSProperties, ReactElement, ReactNode } from 'react';
import type { IconRef } from '@weasel-js/icons';
import type { PrefBarLead } from '@weasel-js/prefs';
import { resolveIcon } from '../../icons/resolveIcon';
import { BarMenu } from './BarMenu';
import { barMenuRoot } from './barMenuRoot';
import { BarPopover } from './BarPopover';
import { BAR_ITEM } from './useBarOverflow';
import { barLeafName, type BarCell, type BarLayoutProps, type BarLeafNode, type BarNode } from './BarLayout';
import s from './Bar.module.css';

/** One thing on a bar's line, keyed: a divider, or a cell drawn for the leaf or group at `path`. */
export interface BarItem {
  key: string;
  divider?: boolean;
  path?: string;
  leaf?: boolean;
  content?: ReactNode;
}

/**
 * `nodes` as the items of a bar's line: cells in order, a divider on each side of a run, and a button for each
 * group that opens. With `popLeaves`, every leaf but an action opens from a button, as a bar with no room beside
 * a field draws it.
 */
export function barItems(nodes: readonly BarNode[], opts: { popLeaves: boolean; cells: BarLayoutProps['cells']; row: BarLayoutProps['row'] }): BarItem[] {
  const { popLeaves, cells, row } = opts;
  const items: Omit<BarItem, 'key'>[] = [];

  const walk = (list: readonly BarNode[]): void => {
    let pending: BarLeafNode[] = [];
    const flush = (): void => {
      const drawn = popLeaves
        ? pending.flatMap((node): readonly BarCell[] => {
            if (node.leaf.kind === 'action' || node.leaf.kind === 'actions') return cells([node]);
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
        const rule = <span className={s.rule} role="separator" aria-orientation={popLeaves ? 'horizontal' : 'vertical'} />;
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
        items.push({ path: node.path, leaf: false, content: <BarPopover label={node.name} icon={resolveIcon(node.icon)}>{node.body()}</BarPopover> });
        continue;
      }
      if (node.kind === 'menu') {
        const menu = (
          <BarMenu label={node.name} icon={resolveIcon(node.group.icon)} description={node.group.description} schema={barMenuRoot(node.group, node.path)} {...node.sources} />
        );
        items.push({ path: node.path, leaf: false, content: menu });
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
  const shown: BarItem[] = items
    .filter((item, i) => !item.divider || (i > 0 && i < items.length - 1 && !items[i - 1]!.divider))
    .map((item, i) => ({ ...item, key: item.divider ? `divider:${i}` : item.path! }));
  while (shown.at(-1)?.divider) shown.pop();
  return shown;
}

/** `items` split where the line ends after `kept` of them, with no divider left at the line's end or the rest's start. */
export function splitBarItems(items: readonly BarItem[], kept: number): { line: BarItem[]; rest: BarItem[] } {
  const line = items.slice(0, kept);
  while (line.at(-1)?.divider) line.pop();
  const rest = items.slice(kept);
  while (rest[0]?.divider) rest.shift();
  return { line, rest };
}

/** What a bar's line starts with: `label` for `lead: 'label'`, `icon` for `'icon'`, else nothing. */
export function barLead(lead: PrefBarLead | undefined, label: string | undefined, icon: IconRef | undefined): ReactNode {
  return lead === 'label' ? label : lead === 'icon' ? resolveIcon(icon) : undefined;
}

/** Where a drawn item sits along a curve: its class, the custom properties that place it, and how far it is clipped. */
export interface BarItemPlace {
  className: string;
  style: CSSProperties;
  clipped?: string;
}

/** An item as its element, a divider set `across` the line when the line runs down; `place` sets it along a curve. */
export function drawBarItem(item: BarItem, across: boolean, attrs: BarLayoutProps['attrs'], place?: BarItemPlace): ReactElement {
  const own = (base: string | undefined): string | undefined => (place ? `${base} ${place.className}` : base);
  return item.divider ? (
    <span key={item.key} {...{ [BAR_ITEM]: item.key }} className={own(s.divider)} role="separator" aria-orientation={across ? 'horizontal' : 'vertical'} style={place?.style} />
  ) : (
    <span key={item.key} {...{ [BAR_ITEM]: item.key }} className={own(s.cell)} {...attrs?.(item.path!, item.leaf!)} style={place?.style} data-clipped={place?.clipped}>
      {item.content}
    </span>
  );
}
