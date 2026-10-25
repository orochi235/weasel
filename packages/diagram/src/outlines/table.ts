/**
 * The outline table: every name an `Outline` string can resolve to. The
 * built-ins are seeded here; `registerOutline` adds to them or shadows one.
 */
import { BPMN_OUTLINES } from './bpmn';
import { FIGURE_OUTLINES } from './figures';
import { FLOWCHART_OUTLINES } from './flowchart';
import { NETWORK_OUTLINES } from './network';
import { STORAGE_OUTLINES } from './storage';
import type { OutlineDef } from './types';

export { outlineFromD } from './fromD';

const BUILTINS = {
  ...FLOWCHART_OUTLINES, ...FIGURE_OUTLINES, ...STORAGE_OUTLINES, ...NETWORK_OUTLINES, ...BPMN_OUTLINES,
};

/** A name the kit itself registers. */
export type BuiltinOutline = keyof typeof BUILTINS;

// A stack per name, so a disposer can restore whatever its registration shadowed.
const table = new Map<string, OutlineDef[]>(
  Object.entries(BUILTINS).map(([name, def]) => [name, [def as OutlineDef]]),
);
const warned = new Set<string>();

/** Register `def` under `name`, shadowing any definition already there.
 *  Returns the disposer. */
export function registerOutline(name: string, def: OutlineDef): () => void {
  const stack = table.get(name) ?? [];
  stack.push(def);
  table.set(name, stack);
  return () => {
    const i = stack.lastIndexOf(def);
    if (i >= 0) stack.splice(i, 1);
    if (stack.length === 0) table.delete(name);
  };
}

/** The definition `name` resolves to. An unregistered name resolves to
 *  `rect`, with one warning per name. */
export function resolveOutline(name: string): OutlineDef {
  const def = table.get(name)?.at(-1);
  if (def) return def;
  if (!warned.has(name)) {
    warned.add(name);
    console.warn(`@weasel-js/diagram: no outline named '${name}' is registered; painting it as 'rect'`);
  }
  return FLOWCHART_OUTLINES.rect;
}
