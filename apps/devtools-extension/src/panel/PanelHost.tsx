/**
 * The panel page's root: the weasel panel while the inspected page has a
 * hook, and a short note while it does not. Each new page gets a fresh panel,
 * so it says `yo` to the new page's hook.
 */
import { useEffect, useState } from 'react';
import type { PanelTransport } from '@weasel-js/core/devtools-protocol';
import { DevtoolsPanel } from '@weasel-js/devtools';
import { watchHookPresence, type PresenceOptions } from '../hookPresence';
import s from './panel.module.css';

export function PanelHost({ presence, transport }: { presence: PresenceOptions; transport: PanelTransport }) {
  const [state, setState] = useState<{ present: boolean | null; page: number }>({ present: null, page: 0 });

  useEffect(
    () => watchHookPresence(presence, (present) => setState((st) => ({ present, page: st.page + 1 }))),
    [presence],
  );

  if (state.present === null) return <p className={s.state}>Looking for weasel…</p>;
  if (!state.present) {
    return (
      <p className={s.state}>
        No weasel on this page. The panel connects once a page mounts a weasel canvas in a dev build, or
        imports <code>@weasel-js/core/devtools</code>.
      </p>
    );
  }
  return <DevtoolsPanel key={state.page} transport={transport} />;
}
