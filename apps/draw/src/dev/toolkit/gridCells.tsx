import type { ReactNode } from 'react';
import s from '../ToolkitBuilder.module.css';

/** Codes a value, or a muted dash when it is absent. */
export function codeOrDash(v: string | undefined): ReactNode {
  return v == null || v === '' ? <span className={s.empty}>—</span> : <code>{v}</code>;
}

export const SPECIFICITY_HEADER = (
  <span title="target, required mods, phase declared, typed drop/paste">Specificity</span>
);

/** Gives each row an `id` from its `key`, numbering repeats so two identical
 *  bindings still get distinct, order-independent ids. */
export function withUniqueIds<T extends { key: string }>(rows: readonly T[]): (T & { id: string })[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const n = seen.get(r.key) ?? 0;
    seen.set(r.key, n + 1);
    return { ...r, id: n === 0 ? r.key : `${r.key}#${n}` };
  });
}
