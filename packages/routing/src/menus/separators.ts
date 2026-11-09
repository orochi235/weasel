import type { MenuEntry } from '@weasel-js/menu';

/** A separator row under `key`. */
export const sep = (key: string): MenuEntry => ({ kind: 'separator', key });

/** Drop leading, trailing, and doubled separators. */
export function tidy(entries: MenuEntry[]): MenuEntry[] {
  const out: MenuEntry[] = [];
  for (const e of entries) {
    if (e.kind === 'separator' && (!out.length || out[out.length - 1]!.kind === 'separator')) continue;
    out.push(e);
  }
  if (out[out.length - 1]?.kind === 'separator') out.pop();
  return out;
}

/** `rows` with `reason` on each disabled row, submenus' rows included, that gives none of its own. */
export function withReason(rows: MenuEntry[], reason: string | undefined): MenuEntry[] {
  if (reason === undefined) return rows;
  return rows.map((e): MenuEntry => {
    if (e.kind === 'separator') return e;
    const said = e.disabled === true && e.disabledReason === undefined ? { ...e, disabledReason: reason } : e;
    return said.kind === 'submenu' ? { ...said, entries: withReason([...said.entries], reason) } : said;
  });
}
