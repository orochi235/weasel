import { prefAliasTarget, prefLeafAt, type PrefAlias, type PrefLeaf } from '@weasel-js/prefs';
import type { PrefFieldChoice } from '../Prefs/schema';
import type { SchemaRoot } from './schemaEdit';

/** The fields an alias's `of` may name: those that would leave each of `aliases` showing a pref. */
export function aliasChoices(schema: SchemaRoot, aliases: readonly PrefLeaf[], choices: readonly PrefFieldChoice[]): PrefFieldChoice[] {
  return choices.filter(({ path }) => {
    const pointed = { kind: 'alias', name: '', description: '', default: undefined, of: path } as PrefAlias;
    // Each alias read as it would be once pointed there, so one that would lead back to itself finds no target.
    const leafAt = (at: string): PrefLeaf | undefined => {
      const leaf = prefLeafAt(schema, at);
      return leaf !== undefined && aliases.includes(leaf) ? pointed : leaf;
    };
    return prefAliasTarget(pointed, leafAt) !== undefined;
  });
}
