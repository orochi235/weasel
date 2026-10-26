import type { Tool } from '@weasel-js/core';

const MISC = 'misc';

/** One separator-divided run of a palette: a presentation group and its tools, in display order. */
export interface PaletteGroup {
  key: string;
  tools: Tool[];
}

/** Ranks by position in `order`; anything it doesn't name sorts after, keeping its place. */
function byRank<T>(items: readonly T[], keyOf: (item: T) => string, order: readonly string[]): T[] {
  const rank = new Map(order.map((k, i) => [k, i]));
  const at = (item: T) => rank.get(keyOf(item)) ?? order.length;
  return items.map((item, i) => ({ item, i })).sort((a, b) => at(a.item) - at(b.item) || a.i - b.i).map((e) => e.item);
}

/**
 * Splits `list` into presentation groups, ordered by `groupOrder` and each group's tools by
 * `toolOrder`. Groups and tools neither names keep their order in `list` after the named ones; tools
 * with no group go in `misc`, last.
 */
export function groupTools(list: readonly Tool[], groupOrder: readonly string[], toolOrder: readonly string[]): PaletteGroup[] {
  const groups = new Map<string, Tool[]>();
  for (const tool of list) {
    const key = tool.presentation?.group ?? MISC;
    groups.set(key, [...(groups.get(key) ?? []), tool]);
  }
  const keys = byRank([...groups.keys()].filter((k) => k !== MISC), (k) => k, groupOrder);
  if (groups.has(MISC)) keys.push(MISC);
  return keys.map((key) => ({ key, tools: byRank(groups.get(key)!, (t) => t.id, toolOrder) }));
}
