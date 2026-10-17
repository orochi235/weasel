import type { PrefLeaf } from '@weasel-js/prefs';

/** What an action pref's attributes are told of an action the host has registered. */
export interface RegisteredAction {
  key: string;
  label: string;
  group?: string;
  tags?: readonly string[];
  shortcut?: string;
}

/** What the registry says of the action a pref fires, which the pref does not hold and no row edits. */
export function registeredFacts(action: RegisteredAction | undefined): Array<[string, unknown]> {
  if (!action) return [];
  const facts: Array<[string, unknown]> = [['registered as', action.label], ['registered group', action.group], ['registered tags', action.tags?.join(', ')], ['shortcut', action.shortcut]];
  return facts.filter(([, value]) => value !== undefined && value !== '');
}

/** The `action` attribute as a choice among the keys a host has, with the key the pref holds now if it is none of them. */
export function actionChoice(attr: PrefLeaf, actions: readonly RegisteredAction[], held: string | undefined): PrefLeaf {
  const options = actions.map((a) => ({ value: a.key, label: `${a.label} (${a.key})` }));
  if (held !== undefined && held !== '' && !actions.some((a) => a.key === held)) options.unshift({ value: held, label: `${held} (not registered)` });
  return { kind: 'enum', name: attr.name, description: attr.description, default: undefined, clearable: true, options } as PrefLeaf;
}
