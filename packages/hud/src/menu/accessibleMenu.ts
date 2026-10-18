import type { MenuController } from '@weasel-js/menu';
import type { HudAccessibleNode } from '../widget';

/** One level's rows, with the open submenu nested under the row it hangs from. */
function level(c: MenuController, at: number): HudAccessibleNode[] {
  const stack = c.stack();
  const deepest = at === stack.length - 1;
  return c.entriesAt(at).map((e, i): HudAccessibleNode => {
    if (e.kind === 'separator') return { role: 'separator', key: e.key };
    const checkable = e.kind === 'item' && e.checked !== undefined;
    const open = e.kind === 'submenu' && stack[at] === i && stack.length > at + 1;
    return {
      role: checkable ? 'menuitemcheckbox' : 'menuitem',
      key: e.key,
      label: e.label,
      ...(deepest && stack[at] === i ? { active: true } : {}),
      ...(e.kind === 'item' && e.checked !== undefined ? { checked: e.checked } : {}),
      ...(e.disabled ? { disabled: true } : {}),
      ...(e.kind === 'submenu' ? { expanded: open } : {}),
      ...(open ? { children: [{ role: 'menu', key: 'menu', label: e.label, children: level(c, at + 1) }] } : {}),
    };
  });
}

/** An open menu as the accessibility tree a DOM menu's panels show: rows with their roles and states, and the
 *  highlighted row of the innermost open level active. */
export function accessibleMenu(c: MenuController): HudAccessibleNode {
  return { role: 'menu', key: 'menu', label: 'Context menu', children: level(c, 0) };
}
