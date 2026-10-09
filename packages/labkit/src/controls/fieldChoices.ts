import { type PrefFieldChoice, prefFieldChoices } from '@weasel-js/ui';
import { createContext, useContext, useMemo } from 'react';
import { type PrefGroup } from '@weasel-js/prefs';

/** The fields of the config a panel draws, which a `field` leaf names one of. */
export const FieldChoicesContext = createContext<readonly PrefFieldChoice[]>([]);

/** `group`'s fields as choices, by config path: a group's key is part of the path. */
export function useFieldChoicesOf(group: PrefGroup): readonly PrefFieldChoice[] {
  return useMemo(() => prefFieldChoices(group), [group]);
}

/** The fields a `field` leaf in this panel may name. */
export function useFieldChoices(): readonly PrefFieldChoice[] {
  return useContext(FieldChoicesContext);
}
