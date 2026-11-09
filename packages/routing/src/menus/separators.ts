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
