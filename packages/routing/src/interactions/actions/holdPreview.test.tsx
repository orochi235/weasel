/** `holdPreview`: an action held on a key, from a keymap — the press shows its preview, the release runs it, and a
 *  cancel takes the preview down without running it. */
import { describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useEffect, useRef } from 'react';
import { held, key } from '@weasel-js/gestures';
import { ActionsProvider, useActionsRegistry } from './ActionsProvider';
import { ActiveToolContextProvider } from './activeToolContext';
import { DepRegistryProvider } from './depRegistry';
import { ActionDisabledReason, type Action } from './action';
import { createDispatcher } from '../dispatcher/dispatcher';
import { useGestureDispatcher } from '../dispatcher/useGestureDispatcher';
import { keymapContribution } from '../../keymaps/keymapContribution';
import { holdPreview, holdPreviewId } from './holdPreview';

function rig(opts: { enabled?: Action['enabled'] } = {}) {
  const shown = vi.fn();
  const hidden = vi.fn();
  const run = vi.fn();
  const unite: Action = {
    id: 'unite',
    label: 'Unite',
    ...(opts.enabled ? { enabled: opts.enabled } : {}),
    preview: (_deps, params) => { shown(params); return hidden; },
    invoker: { timing: 'immediate', run: (_deps, params) => run(params) },
  };
  const entries = keymapContribution({
    id: 'paths',
    label: 'Paths',
    leader: key('p'),
    bindings: [{ spec: held('u'), actionId: holdPreviewId('unite'), opts: { params: { op: 'union' } } }],
    actions: [unite, holdPreview(unite)],
  });
  const dispatcher = createDispatcher();
  function Probe() {
    const registry = useActionsRegistry()!;
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    useEffect(() => {
      const releases = entries.flatMap((e) => e.actions ?? []).map((a) => registry.register(a));
      return () => { for (const r of releases) r(); };
    });
    useGestureDispatcher({ canvasRef, actions: registry, dispatcher, entriesById: new Map(entries.map((e) => [e.id, e])) });
    return <canvas ref={canvasRef} />;
  }
  render(
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>
          <Probe />
        </ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>,
  );
  const send = (type: 'keydown' | 'keyup', k: string) => {
    act(() => { window.dispatchEvent(new KeyboardEvent(type, { key: k, code: `Key${k.toUpperCase()}` })); });
  };
  const tap = (k: string) => { send('keydown', k); send('keyup', k); };
  return { shown, hidden, run, send, tap, dispatcher };
}

describe('holdPreview', () => {
  it('shows the preview while the key is held, and runs the action on release', () => {
    const r = rig();
    r.tap('p');
    r.send('keydown', 'u');
    expect(r.shown).toHaveBeenCalledWith({ op: 'union' });
    expect(r.run).not.toHaveBeenCalled();
    r.send('keydown', 'u');
    expect(r.shown).toHaveBeenCalledTimes(1);
    r.send('keyup', 'u');
    expect(r.hidden).toHaveBeenCalledTimes(1);
    expect(r.run).toHaveBeenCalledWith({ op: 'union' });
  });

  it('takes the preview down and runs nothing when the hold is canceled', () => {
    const r = rig();
    r.tap('p');
    r.send('keydown', 'u');
    act(() => { r.dispatcher.cancelAll('cancel'); });
    expect(r.hidden).toHaveBeenCalledTimes(1);
    r.send('keyup', 'u');
    expect(r.run).not.toHaveBeenCalled();
  });

  it('is disabled where the action is, so the key does nothing', () => {
    const r = rig({ enabled: () => ActionDisabledReason.SelectionRequired });
    r.tap('p');
    r.send('keydown', 'u');
    r.send('keyup', 'u');
    expect(r.shown).not.toHaveBeenCalled();
    expect(r.run).not.toHaveBeenCalled();
  });
});
