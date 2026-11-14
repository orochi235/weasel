import { Children, Fragment, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { resolveIcon } from '../Icon/resolveIcon';
import { offTitle } from '../Prefs/offTitle';
import type { BarSide } from './barSide';
import { RunScope } from '../Run';
import type { RunSpot } from '@weasel-js/geom';
import { BAR_IN, BAR_UNIT, barUnitKey } from './barOrder';
import { BAR_ITEM } from './useBarOverflow';
import { BarDivider, BarGroup, BarItem, BarSpacer } from './barParts';
import type { BarProps } from './Bar';
import s from './Bar.module.css';

/** One thing on a bar's line, keyed: a divider, a spacer, or a cell holding `content`. */
export interface LineItem {
  key: string;
  divider?: boolean;
  spacer?: boolean;
  /** A rule set across whichever line it lands on, kept where it was put. */
  rule?: boolean;
  content?: ReactNode;
  /** The container a reorder moves the item within, `''` at the top level. Set only where the bar marks its units. */
  in?: string;
  attrs?: Record<string, string | undefined>;
}

type Pending = Omit<LineItem, 'key'> & { key?: string };

/** The direct children of a bar, fragments and arrays opened, with their own keys. */
function flatChildren(children: ReactNode, out: ReactNode[] = []): ReactNode[] {
  Children.forEach(children, (child) => {
    if (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment) flatChildren(child.props.children, out);
    else if (child != null && typeof child !== 'boolean') out.push(child);
  });
  return out;
}

/**
 * A bar's children as the items of its line. A `Bar.Group` is one unit with a divider on each side, and an `end` one
 * has a spacer ahead of it; a `Bar.Item` carries its own key, container, and attributes. `mark` gives every keyed
 * unit a container, so a reorder can move it.
 */
export function lineItems(children: ReactNode, mark: boolean): LineItem[] {
  const items: Pending[] = [];
  flatChildren(children).forEach((child, i) => {
    const key = isValidElement(child) && child.key !== null ? String(child.key) : `.${i}`;
    if (!isValidElement(child)) {
      items.push({ key, content: child });
    } else if (child.type === BarDivider) {
      items.push({ divider: true });
    } else if (child.type === BarSpacer) {
      items.push({ key, spacer: true });
    } else if (child.type === BarItem) {
      const p = child.props as { id: string; in?: string; rule?: boolean; attrs?: Record<string, string | undefined>; children?: ReactNode };
      items.push({ key: p.id, content: p.children, ...(p.rule ? { rule: true } : {}), ...(p.attrs ? { attrs: p.attrs } : {}), ...(mark && p.in !== undefined ? { in: p.in } : {}) });
    } else if (child.type === BarGroup) {
      if ((child.props as { end?: boolean }).end) items.push({ key: `${key}:end`, spacer: true });
      items.push({ divider: true }, { key, content: child }, { divider: true });
    } else {
      items.push({ key, content: child, ...(mark && child.key !== null ? { in: '' } : {}) });
    }
  });
  return tidyDividers(items);
}

/** `items` keyed, with no divider opening or closing the line, next to a spacer, or next to another. */
function tidyDividers(items: readonly Pending[]): LineItem[] {
  const gap = (item: { divider?: boolean; spacer?: boolean } | undefined): boolean => item === undefined || item.divider === true || item.spacer === true;
  const shown: LineItem[] = [];
  items.forEach((item, i) => {
    if (item.divider && (gap(shown.at(-1)) || gap(items[i + 1]))) return;
    shown.push({ ...item, key: item.divider ? `divider:${i}` : item.key! });
  });
  while (shown.at(-1)?.divider) shown.pop();
  return shown;
}

/** `items` with a divider between every two neighbors, none beside a spacer. */
export function dividedItems(items: readonly LineItem[]): LineItem[] {
  return tidyDividers(items.flatMap((item, i): Pending[] => (i === 0 ? [item] : [{ divider: true }, item])));
}

/** `item` as drawn in the overflow menu, where a unit cannot be dragged. */
export const inBarMenu = (item: LineItem): LineItem => (item.in === undefined ? item : { ...item, in: undefined });

/** `items` split where the line ends after `kept` of them, with no divider left at the line's end or the rest's start. */
export function splitBarItems(items: readonly LineItem[], kept: number): { line: LineItem[]; rest: LineItem[] } {
  const line = items.slice(0, kept);
  while (line.at(-1)?.divider) line.pop();
  const rest = items.slice(kept);
  while (rest[0]?.divider) rest.shift();
  return { line, rest };
}

/** What a bar's line starts with: `label` for `lead: 'label'`, `icon` for `'icon'`, else nothing. Dimmed while the bar is off. */
export function barLead({ lead, label, icon, off }: Pick<BarProps, 'lead' | 'label' | 'icon' | 'off'>): ReactNode {
  const shown = lead === 'label' ? label : lead === 'icon' ? resolveIcon(icon) : undefined;
  return shown == null || shown === '' ? shown : offTitle(shown, off === true);
}

/** Where a drawn item sits along a curve: its class, the custom properties that place it, and how far it is clipped. */
export interface BarItemPlace {
  className: string;
  style: CSSProperties;
  clipped?: RunSpot['clipped'];
  /** The side its popovers and menus open on. */
  side?: BarSide;
}

/** An item as its element, a divider or rule set `across` the line when the line runs down; `place` sets it along a curve. */
export function drawBarItem(item: LineItem, across: boolean, place?: BarItemPlace): ReactElement {
  const own = (base: string | undefined): string | undefined => (place ? `${base} ${place.className}` : base);
  const orient = across ? 'horizontal' : 'vertical';
  if (item.divider) {
    return <span key={item.key} {...{ [BAR_ITEM]: item.key }} className={own(s.divider)} role="separator" aria-orientation={orient} style={place?.style} data-clipped={place?.clipped} />;
  }
  if (item.spacer) return <span key={item.key} {...{ [BAR_ITEM]: item.key }} className={own(s.spacer)} aria-hidden="true" style={place?.style} />;
  return (
    <span key={item.key} {...{ [BAR_ITEM]: item.key }} className={own(s.cell)} {...item.attrs} {...(item.in !== undefined ? { [BAR_IN]: item.in, [BAR_UNIT]: barUnitKey(item.key) } : {})} style={place?.style} data-clipped={place?.clipped}>
      {item.rule ? (
        <span className={s.rule} role="separator" aria-orientation={orient} />
      ) : place?.side ? (
        <RunScope side={place.side}>{item.content}</RunScope>
      ) : (
        item.content
      )}
    </span>
  );
}
