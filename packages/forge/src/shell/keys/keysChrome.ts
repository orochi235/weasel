import { type Action, useActionsRegistry } from '@weasel-js/core';
import { type LabContribution, usePersistedState } from '@weasel-js/labkit';
import { useEffect, useMemo } from 'react';
import { icon } from '../../icons.gen';
import { KEYS_SECTION } from './KeysPanel';

const RECORD = 'fg-keys-shown';

export const KEYS_TOGGLE_ID = 'forge.keys.toggle';

/** Matched by code: Alt changes the character a key produces on macOS. Never plain `?`, which would fire while typing. */
const OPEN_KEY = { kind: 'key', key: '/', code: 'Slash', mods: { alt: true } } as const;

/** The header's Keys toggle, then the panel itself while the toggle is on. */
export function keysChrome(shown: boolean, toggle: () => void): readonly LabContribution[] {
  return [
    {
      id: 'fg-keys-toggle',
      region: 'header',
      group: 'story',
      item: { icon: icon('ui:keyboard'), label: 'Keys panel', pressed: shown, onActivate: toggle },
    },
    ...(shown ? [KEYS_SECTION] : []),
  ];
}

/**
 * Reports `keysChrome` to `onChrome` as the lab's persisted choice changes, and answers Alt+Slash by flipping it.
 * Renders nothing; mount it inside the lab, since the choice lives there.
 */
export function KeysChrome({ onChrome }: { onChrome: (chrome: readonly LabContribution[]) => void }) {
  const [shown, setShown] = usePersistedState<boolean>(RECORD, false, { scope: 'lab' });
  const registry = useActionsRegistry();
  const chrome = useMemo(() => keysChrome(shown, () => setShown((was) => !was)), [shown, setShown]);
  useEffect(() => onChrome(chrome), [chrome, onChrome]);
  useEffect(() => {
    if (!registry) return;
    const action: Action = {
      id: KEYS_TOGGLE_ID,
      label: 'Toggle the keys panel',
      group: 'forge',
      defaultBinding: [{ spec: OPEN_KEY, opts: { id: KEYS_TOGGLE_ID } }],
      invoker: { timing: 'immediate', run: () => setShown((was) => !was) },
    };
    return registry.register(action);
  }, [registry, setShown]);
  return null;
}
