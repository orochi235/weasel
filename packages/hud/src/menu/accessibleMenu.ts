import { menuNumberText, type MenuController, type MenuEntry, type MenuRowEntry } from '@weasel-js/menu';
import type { HudAccessibleNode } from '../widget';

/** A row's name: a value row's label and the value it holds now, and a color picker's label and its color. */
function labelOf(c: MenuController, e: MenuRowEntry, swatchOf?: (e: MenuEntry) => string | undefined, locale?: string): string {
  if (e.kind === 'number') return `${e.label}: ${menuNumberText(c.numberValue(e), e, locale)}`;
  if (e.kind === 'color') return `${e.label}: ${e.value ?? '—'}`;
  if (e.kind === 'text') return `${e.label}: ${c.textValue(e) ?? '—'}`;
  if (e.kind === 'submenu' && swatchOf?.(e) !== undefined) return `${e.label}: ${swatchOf(e)}`;
  return e.label;
}

/** What a row says after its name: why it is disabled, else what it does. A symbolic reason code is read as it is. */
function descriptionOf(e: MenuRowEntry): string | undefined {
  if (e.disabled && e.disabledReason) return e.disabledReason;
  return (e.kind === 'item' || e.kind === 'submenu') && e.description ? e.description : undefined;
}

/** One level's rows, with the open submenu nested under the row it hangs from. */
function level(c: MenuController, at: number, swatchOf?: (e: MenuEntry) => string | undefined, locale?: string): HudAccessibleNode[] {
  const stack = c.stack();
  const deepest = at === stack.length - 1;
  return c.entriesAt(at).map((e, i): HudAccessibleNode => {
    if (e.kind === 'separator') return { role: 'separator', key: e.key };
    const checkable = e.kind === 'item' && e.checked !== undefined;
    const open = e.kind === 'submenu' && stack[at] === i && stack.length > at + 1;
    const description = descriptionOf(e);
    return {
      role: !checkable ? 'menuitem' : e.radio ? 'menuitemradio' : 'menuitemcheckbox',
      key: e.key,
      label: labelOf(c, e, swatchOf, locale),
      ...(description ? { description } : {}),
      ...(deepest && stack[at] === i ? { active: true } : {}),
      ...(e.kind === 'item' && e.checked !== undefined ? { checked: e.checked } : {}),
      ...(e.disabled || e.kind === 'color' ? { disabled: true } : {}),
      ...(e.kind === 'submenu' ? { expanded: open } : {}),
      ...(open ? { children: [{ role: 'menu', key: 'menu', label: e.label, children: level(c, at + 1, swatchOf, locale) }] } : {}),
    };
  });
}

/** An open menu as the accessibility tree a DOM menu's panels show: rows with their roles and states, and the
 *  highlighted row of the innermost open level active. `swatchOf` names the color a picker holds, and `locale` is
 *  the one a number row's value is written in. */
export function accessibleMenu(c: MenuController, swatchOf?: (e: MenuEntry) => string | undefined, locale?: string): HudAccessibleNode {
  return { role: 'menu', key: 'menu', label: 'Context menu', children: level(c, 0, swatchOf, locale) };
}
