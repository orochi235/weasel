import { useRef } from 'react';
import { EMPTY_TYPEAHEAD, TYPEAHEAD_RESET_MS, typeaheadStep, type TypeaheadShape } from '@weasel-js/ui-logic';
import { useKitSetting } from '@weasel-js/react';

/** How long a typed prefix lasts before the next key starts a new one. */
export const TYPEAHEAD_MS = TYPEAHEAD_RESET_MS;

/** A list's typeahead, timed by the `tree.typeaheadMs` kit setting: whether a search is under way, and the item one
 *  more key lands on, searching from `from`. A repeated letter cycles through the items it starts. */
export function useTypeahead(): {
  searching(): boolean;
  type<T>(items: readonly T[], from: number | null, key: string, shape: TypeaheadShape<T>): number | null;
} {
  const ms = useKitSetting('tree.typeaheadMs') ?? TYPEAHEAD_MS;
  const buffer = useRef(EMPTY_TYPEAHEAD);
  return {
    searching: () => Date.now() - buffer.current.at < ms,
    type: (items, from, key, shape) => {
      const step = typeaheadStep(items, from, buffer.current, key, Date.now(), shape, ms);
      buffer.current = step.buffer;
      return step.hit;
    },
  };
}
