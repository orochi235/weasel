import type { MenuColorEntry, MenuController, MenuEntry, MenuTextEntry } from '@weasel-js/menu';

/** The swatches a HUD menu's color row offers when given no palette. */
export const DEFAULT_MENU_PALETTE: readonly string[] = [
  '#000000', '#595959', '#a6a6a6', '#ffffff',
  '#e53935', '#fb8c00', '#fdd835', '#43a047',
  '#00acc1', '#1e88e5', '#8e24aa', '#d81b60',
];

/** Entries with each color row a HUD menu can write turned into a picker, and the color each row shows. */
export interface HudColorPickers {
  entries: MenuEntry[];
  /** The color drawn in `e`'s icon column: a picker's current color, or a swatch's own. */
  swatchOf(e: MenuEntry): string | undefined;
}

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** `text` as the `#rrggbb` (or with `alpha`, `#rrggbbaa`) a color row writes, or undefined when it is no hex color.
 *  Without `alpha`, an alpha typed is dropped; with it, a color typed without one takes `keep`'s, else opaque. */
export function hexColor(text: string, alpha: boolean, keep?: string): string | undefined {
  const m = HEX.exec(text.trim());
  if (!m) return undefined;
  let hex = m[1]!.toLowerCase();
  if (hex.length === 3) hex = Array.from(hex, (ch) => ch + ch).join('');
  const rgb = hex.slice(0, 6);
  if (!alpha) return `#${rgb}`;
  const kept = keep && /^#[0-9a-f]{8}$/i.test(keep) ? keep.slice(7).toLowerCase() : 'ff';
  return `#${rgb}${hex.length === 8 ? hex.slice(6) : kept}`;
}

/**
 * `entries` with every color row that has a `set` and is not disabled made a submenu: one row per `palette` color,
 * drawn as its swatch, which writes that color, then a text row holding the hex, which writes what is typed into
 * it. Both leave the menu open. `c` is the controller the entries go to, read only once a row
 * is drawn or chosen.
 */
export function withColorPickers(
  entries: readonly MenuEntry[], palette: readonly string[], c: () => Pick<MenuController, 'colorValue' | 'setColor'>,
): HudColorPickers {
  const swatches = new Map<MenuEntry, () => string | undefined>();
  const picker = (e: MenuColorEntry): MenuEntry => {
    const now = () => c().colorValue(e);
    const alpha = e.alpha === true;
    const rows: MenuEntry[] = palette.map((color) => {
      const value = hexColor(color, alpha, e.value) ?? color;
      const row: MenuEntry = {
        kind: 'item', key: `${e.key}/${color}`, label: color,
        keepOpen: true,
        get checked() { return hexColor(now() ?? '', alpha) === hexColor(value, alpha); },
        run: () => c().setColor(e, hexColor(color, alpha, now()) ?? color),
      };
      swatches.set(row, () => value);
      return row;
    });
    const hex: MenuTextEntry = {
      kind: 'text', key: `${e.key}/#`, label: 'Hex',
      get value() { return now(); },
      set: (text) => {
        const value = hexColor(text, alpha, now());
        if (value !== undefined) c().setColor(e, value);
      },
    };
    const sub: MenuEntry = {
      kind: 'submenu', key: e.key, label: e.label, ...(e.access ? { access: e.access } : {}),
      entries: [...rows, { kind: 'separator', key: `${e.key}/|` }, hex],
    };
    swatches.set(sub, now);
    return sub;
  };
  const walk = (es: readonly MenuEntry[]): MenuEntry[] => es.map((e) => {
    if (e.kind === 'submenu') return { ...e, entries: walk(e.entries) };
    if (e.kind === 'color' && e.set && !e.disabled) return picker(e);
    return e;
  });
  const out = walk(entries);
  return { entries: out, swatchOf: (e) => swatches.get(e)?.() };
}
