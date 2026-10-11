import type { PrefLeaf } from '@weasel-js/prefs';

/** The types an editor may place: leaves made with `prefType`, each found by the name in its `type`. */
export type PrefTypes = readonly PrefLeaf[];

export const NO_TYPES: PrefTypes = [];

/** One entry of a kind picker. */
export interface KindChoice {
  value: string;
  label: string;
}

const PREFIX = 'type:';

/** A kind picker's value for the type called `name`, which no kind's own name can be mistaken for. */
export const typeChoice = (name: string): string => `${PREFIX}${name}`;

/** The type a picker's value names, or `undefined` for a kind's. */
export const typeNamed = (choice: string): string | undefined => (choice.startsWith(PREFIX) ? choice.slice(PREFIX.length) : undefined);

/** The picker value `leaf` stands at: its type's where it has one, else its kind. */
export const choiceOf = (leaf: PrefLeaf): string => (leaf.type !== undefined ? typeChoice(leaf.type) : leaf.kind);

export function findType(types: PrefTypes, name: string | undefined): PrefLeaf | undefined {
  return name === undefined ? undefined : types.find((t) => t.type === name);
}

/** The kinds an entry of a list or a map may be picked from: the ones a single control edits. Anything with a
 *  shape of its own comes in as a type. */
const ENTRY_KINDS = ['number', 'boolean', 'string', 'enum', 'color', 'paint', 'field'];

function choices(kinds: readonly string[], types: PrefTypes, current: PrefLeaf | undefined): KindChoice[] {
  const out: KindChoice[] = [
    ...kinds.map((k) => ({ value: k, label: k })),
    ...types.map((t) => ({ value: typeChoice(t.type!), label: t.type! })),
  ];
  // What the leaf already is stays on the list, so the picker can say so.
  if (current && !out.some((c) => c.value === choiceOf(current))) {
    out.push({ value: choiceOf(current), label: current.type !== undefined ? `${current.type} (not registered)` : current.kind });
  }
  return out;
}

/** What a leaf may be: every kind in `kinds` but `union`, whose variants only code declares, and every type. */
export function kindChoices(kinds: readonly string[], types: PrefTypes, current?: PrefLeaf): KindChoice[] {
  return choices(kinds.filter((k) => k !== 'union'), types, current);
}

/** What one entry of a list or a map may be. */
export function entryChoices(types: PrefTypes, current?: PrefLeaf): KindChoice[] {
  return choices(ENTRY_KINDS, types, current);
}
