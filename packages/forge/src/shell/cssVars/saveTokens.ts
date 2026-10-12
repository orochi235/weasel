import { isPlainObject } from '@weasel-js/core';
import type { Selection, ThemeDefinition } from '@weasel-js/theme';
import { branchOf, EditError, type Holder, type ScaleEditResult, type Slot } from './saveScales';

const REFERENCE = /\{[^}]+\}/;
/** The layers a token's value can be written out in, in the order the definition resolves a name. */
const LAYERS = ['pins', 'semantics', 'components'] as const;

/** A written-out value, or what makes `entry` something the theme works out instead. */
function derivation(entry: unknown): string | null {
  const value = isPlainObject(entry) ? entry.value : entry;
  if (isPlainObject(entry) && value === undefined) return 'follows a rule';
  if (isPlainObject(entry) && entry.alpha !== undefined) return 'is drawn at an alpha';
  if (typeof value === 'string' && REFERENCE.test(value)) return `follows ${REFERENCE.exec(value)?.[0]}`;
  return typeof value === 'string' || typeof value === 'number' ? null : 'is a list';
}

/** The place `definition` writes `token`'s value out for `selection`. Throws when it has none. */
function literalSlot(definition: ThemeDefinition, token: string, selection: Selection): Slot {
  for (const layer of LAYERS) {
    const entries = definition[layer] as Holder | undefined;
    if (!entries || !(token in entries)) continue;
    const slot = branchOf(entries, token, `${layer}.${token}`, selection);
    const why = derivation(slot.holder[slot.key]);
    if (why) throw new EditError(`${slot.where} ${why}, and only a value written out in the theme can be saved`);
    return slot;
  }
  for (const layer of ['ramps', 'scales'] as const) {
    const from = Object.keys(definition[layer] ?? {}).find((name) => token.startsWith(`${name}-`));
    if (from) throw new EditError(`${token} is a step ${layer}.${from} generates, and the theme pins no value over it`);
  }
  throw new EditError(`the theme defines no token "${token}"`);
}

/** Whether a save has a place for `token`: the definition writes its value out for `selection`. */
export function writtenOut(definition: ThemeDefinition, token: string, selection: Selection): boolean {
  try {
    literalSlot(definition, token, selection);
    return true;
  } catch (e) {
    if (e instanceof EditError) return false;
    throw e;
  }
}

/**
 * `definition` with each edited token's value written where the definition holds it: a pin, a component or a literal
 * semantic, and only the branch for `selection`. `edits` is keyed by token name, without the `--wzl-` prefix. A token
 * whose value the theme derives is refused, since writing a value over it would drop the derivation.
 */
export function applyTokenEdits(
  definition: ThemeDefinition,
  edits: Readonly<Record<string, string>>,
  selection: Selection,
): ScaleEditResult {
  const root = structuredClone(definition);
  try {
    for (const [token, value] of Object.entries(edits)) {
      const { holder, key } = literalSlot(root, token, selection);
      const entry = holder[key];
      holder[key] = isPlainObject(entry) ? { ...entry, value } : value;
    }
  } catch (e) {
    if (e instanceof EditError) return { ok: false, message: `Cannot save: ${e.message}.` };
    throw e;
  }
  return { ok: true, definition: root };
}
