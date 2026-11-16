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
import { createReflectable, type Reflection } from '@weasel-js/registry';
import type { OutlineDef } from './types';

export { outlineFromD } from './fromD';

const BUILTINS = {
  ...FLOWCHART_OUTLINES, ...FIGURE_OUTLINES, ...STORAGE_OUTLINES, ...NETWORK_OUTLINES, ...BPMN_OUTLINES, ...MODELING_OUTLINES,
  ...STATE_OUTLINES, ...PARTICIPANT_OUTLINES,
};

/** A name the kit itself registers. */
export type BuiltinOutline = keyof typeof BUILTINS;

const table = createReflectable<OutlineDef>();
for (const [name, def] of Object.entries(BUILTINS)) table.push(name, def as OutlineDef, { source: 'kit' });
const warned = new Set<string>();

/** Every outline name and the definition it resolves to: the built-ins (source `'kit'`) and what
 *  {@link registerOutline} added, a later registration shadowing an earlier one. */
export const outlineRegistry: Reflection<OutlineDef> = table.reflection;

/** Call `fn` whenever a registration or its disposer changes what a name resolves to. Returns the unsubscriber. */
export function onOutlinesChange(fn: () => void): () => void {
  return table.subscribe(fn);
}

/** Register `def` under `name`, shadowing any definition already there.
 *  Returns the disposer. */
export function registerOutline(name: string, def: OutlineDef): () => void {
  return table.push(name, def);
}

/** The definition `name` resolves to. An unregistered name resolves to
 *  `rect`, with one warning per name. */
export function resolveOutline(name: string): OutlineDef {
  const def = table.get(name);
  if (def) return def;
  if (!warned.has(name)) {
    warned.add(name);
    console.warn(`@weasel-js/diagram: no outline named '${name}' is registered; painting it as 'rect'`);
  }
  return FLOWCHART_OUTLINES.rect;
}
