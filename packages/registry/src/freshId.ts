/** How {@link freshId} numbers: from `from` (default 1), the number set off from the base by `sep` (default `'-'`),
 *  and with `bare`, the base alone tried first. */
export interface FreshIdOptions {
  from?: number;
  sep?: string;
  bare?: boolean;
}

/** The first of `base`, `base-1`, `base-2`, ... (as `opts` shapes them) that `taken` does not hold. */
export function freshId(base: string, taken: { has(id: string): boolean }, opts: FreshIdOptions = {}): string {
  const { from = 1, sep = '-', bare = false } = opts;
  if (bare && !taken.has(base)) return base;
  let n = from;
  while (taken.has(`${base}${sep}${n}`)) n++;
  return `${base}${sep}${n}`;
}
