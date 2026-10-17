import type { MenuEntry } from './entries';

const assign = (href: string): void => {
  if (typeof window !== 'undefined') window.location.assign(href);
};

/** Entries where an item with `href` runs its own `run`, then `navigate(href)`: `location.assign` unless given
 *  another. Recurses into submenus. */
export function withLinks(entries: readonly MenuEntry[], navigate: (href: string) => void = assign): MenuEntry[] {
  return entries.map((e): MenuEntry => {
    if (e.kind === 'submenu') return { ...e, entries: withLinks(e.entries, navigate) };
    if (e.kind !== 'item' || e.href === undefined) return e;
    const { href } = e;
    return { ...e, run: () => { e.run(); navigate(href); } };
  });
}
