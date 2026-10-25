import { useRef } from 'react';
import { useKitSetting } from '@weasel-js/react';

/** How long a typed prefix lasts before the next key starts a new one. */
export const TYPEAHEAD_MS = 500;

/** A list's typed prefix: whether a search is under way, and the prefix once a key is added to it. */
export function useTypeahead(): { searching(): boolean; type(key: string): string } {
  const ms = useKitSetting('tree.typeaheadMs') ?? TYPEAHEAD_MS;
  const typed = useRef({ text: '', at: 0 });
  return {
    searching: () => Date.now() - typed.current.at <= ms,
    type: (key) => {
      const now = Date.now();
      const t = typed.current;
      t.text = now - t.at > ms ? key : t.text + key;
      t.at = now;
      return t.text;
    },
  };
}
