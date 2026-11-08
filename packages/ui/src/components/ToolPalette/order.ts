import type { Tool } from '@weasel-js/core';
import { byRank } from '../../byRank';

const MISC = 'misc';

/** One separator-divided run of a palette: a presentation group and its tools, in display order. */
export interface PaletteGroup {
  key: string;
  tools: Tool[];
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
