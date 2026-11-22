import { Fragment, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { resolveIcon } from '../Icon/resolveIcon';
import { offTitle } from '../Prefs/offTitle';
import type { BarSide } from './barSide';
import { RunScope } from '../Run';
import type { RunSpot } from '@weasel-js/geom';
import { BAR_IN, BAR_UNIT, barUnitKey } from './barOrder';
import { BAR_ITEM, BAR_SPACER } from './useBarOverflow';
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

/** A bar's child and its slot's path, as React keys it: empty slots counted, scoped by array and fragment. */
interface Slotted {
  child: ReactNode;
  path: string;
}

/** The direct children of a bar, fragments and arrays opened, each with its slot's path. */
function flatChildren(children: ReactNode, prefix = '', out: Slotted[] = []): Slotted[] {
  const list: readonly ReactNode[] = Array.isArray(children) ? children : [children];
  list.forEach((child, i) => {
    const path = `${prefix}${isValidElement(child) && child.key !== null ? `$${child.key}` : i}`;
    if (Array.isArray(child)) flatChildren(child as ReactNode[], `${path}:`, out);
    else if (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment) flatChildren(child.props.children, `${path}:`, out);
    else if (child != null && typeof child !== 'boolean') out.push({ child, path: `.${path}` });
  });
  return out;
}

/**
 * A bar's children as the items of its line. A `Bar.Group` is one unit with a divider on each side, and an `end` one
 * has a spacer ahead of it; a `Bar.Item` carries its own key, container, and attributes. `mark` gives every keyed
 * unit a container, so a reorder can move it. A keyless child is keyed by its slot, so a conditional child ahead of it
 * leaves it mounted; a key an earlier child already holds falls back to the slot, with a warning.
 */
export function lineItems(children: ReactNode, mark: boolean): LineItem[] {
  const items: Pending[] = [];
  const taken = new Set<string>();
  const own = (key: string | null, path: string): string => {
    if (key === null) return path;
    if (!taken.has(key)) {
      taken.add(key);
      return key;
    }
    console.warn(`weasel: two of a Bar's children share the key "${key}", so the later one is keyed by its place and is not a unit a reorder moves. Give each child of a bar a key of its own.`);
    return path;
  };
  // A key that fell back to the slot names no unit, so a reorder never writes it into an order.
  const unit = (key: string, wanted: string | null, container: string | undefined = '') => (mark && container !== undefined && key === wanted ? { in: container } : {});
  flatChildren(children).forEach(({ child, path }) => {
    if (!isValidElement(child)) {
      items.push({ key: path, content: child });
    } else if (child.type === BarDivider) {
      items.push({ divider: true });
    } else if (child.type === BarSpacer) {
      items.push({ key: own(child.key, path), spacer: true });
    } else if (child.type === BarItem) {
      const p = child.props as { id: string; in?: string; rule?: boolean; attrs?: Record<string, string | undefined>; children?: ReactNode };
      const key = own(p.id, path);
      items.push({ key, content: p.children, ...(p.rule ? { rule: true } : {}), ...(p.attrs ? { attrs: p.attrs } : {}), ...unit(key, p.id, p.in) });
    } else if (child.type === BarGroup) {
      const key = own(child.key, path);
      if ((child.props as { end?: boolean }).end) items.push({ key: `${key}:end`, spacer: true });
      items.push({ divider: true }, { key, content: child, ...unit(key, child.key) }, { divider: true });
    } else {
      const key = own(child.key, path);
      items.push({ key, content: child, ...unit(key, child.key) });
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
  if (item.spacer) return <span key={item.key} {...{ [BAR_ITEM]: item.key, [BAR_SPACER]: '' }} className={own(s.spacer)} aria-hidden="true" style={place?.style} />;
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
