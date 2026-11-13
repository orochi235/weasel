/**
 * The outline table: every name an `Outline` string can resolve to. The
 * built-ins are seeded here; `registerOutline` adds to them or shadows one.
 */
import { BPMN_OUTLINES } from './bpmn';
import { FIGURE_OUTLINES } from './figures';
import { FLOWCHART_OUTLINES } from './flowchart';
import { NETWORK_OUTLINES } from './network';
import { MODELING_OUTLINES } from './modeling';
import { STATE_OUTLINES } from './states';
import { PARTICIPANT_OUTLINES } from './participants';
import { STORAGE_OUTLINES } from './storage';
import { createEmitter } from '@weasel-js/registry';
import type { OutlineDef } from './types';

export { outlineFromD } from './fromD';

const BUILTINS = {
  ...FLOWCHART_OUTLINES, ...FIGURE_OUTLINES, ...STORAGE_OUTLINES, ...NETWORK_OUTLINES, ...BPMN_OUTLINES, ...MODELING_OUTLINES,
  ...STATE_OUTLINES, ...PARTICIPANT_OUTLINES,
};

/** A name the kit itself registers. */
export type BuiltinOutline = keyof typeof BUILTINS;

// A stack per name, so a disposer can restore whatever its registration shadowed. A record per registration, so
// one def registered twice is two entries and each disposer takes out its own.
const table = new Map<string, { def: OutlineDef }[]>(
  Object.entries(BUILTINS).map(([name, def]) => [name, [{ def: def as OutlineDef }]]),
);
const warned = new Set<string>();
const changes = createEmitter();
const changed = (): void => changes.emit();

/** Call `fn` whenever a registration or its disposer changes what a name resolves to. Returns the unsubscriber. */
export function onOutlinesChange(fn: () => void): () => void {
  return changes.subscribe(fn);
}

/** Register `def` under `name`, shadowing any definition already there.
 *  Returns the disposer. */
export function registerOutline(name: string, def: OutlineDef): () => void {
  const stack = table.get(name) ?? [];
  const mine = { def };
  stack.push(mine);
  table.set(name, stack);
  changed();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    stack.splice(stack.indexOf(mine), 1);
    if (stack.length === 0 && table.get(name) === stack) table.delete(name);
    changed();
  };
}

/** The definition `name` resolves to. An unregistered name resolves to
 *  `rect`, with one warning per name. */
export function resolveOutline(name: string): OutlineDef {
  const def = table.get(name)?.at(-1)?.def;
  if (def) return def;
  if (!warned.has(name)) {
    warned.add(name);
    console.warn(`@weasel-js/diagram: no outline named '${name}' is registered; painting it as 'rect'`);
  }
  return FLOWCHART_OUTLINES.rect;
}
