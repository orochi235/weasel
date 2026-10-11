/** Keys by physical position: a `code` binding, and two keys that share a `key`. */
import { describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import type { Action } from '../actions/action';
import { useGestureDispatcher } from './useGestureDispatcher';

function Probe({ action }: { action: Action }) {
  const registry = useActionsRegistry();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  registry?.register(action);
  useGestureDispatcher({ canvasRef, actions: registry!, entriesById: new Map() });
  return <canvas ref={canvasRef} />;
}

function mount(action: Action): (type: 'keydown' | 'keyup', init: KeyboardEventInit) => void {
  render(
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>
          <Probe action={action} />
        </ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>,
  );
  return (type, init) => { act(() => { window.dispatchEvent(new KeyboardEvent(type, init)); }); };
}

describe('keys by physical position', () => {
  it('fires a code binding when a held modifier changes what the key types', () => {
    const run = vi.fn();
    const key = mount({
      id: 'forward',
      label: 'forward',
      defaultBinding: { kind: 'key', key: ']', code: 'BracketRight', mods: { alt: true } },
      invoker: { timing: 'immediate', run },
    });
    key('keydown', { key: '‘', code: 'BracketRight', altKey: true });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('holds on while one of two Shift keys is still down', () => {
    const ended = vi.fn();
    const key = mount({
      id: 'constrain',
      label: 'constrain',
      defaultBinding: { kind: 'key-held', key: 'Shift', mods: { shift: 'optional' } },
      invoker: { timing: 'ongoing', start: () => ({ onEnd: ended }) },
    });
    key('keydown', { key: 'Shift', code: 'ShiftLeft', shiftKey: true });
    key('keydown', { key: 'Shift', code: 'ShiftRight', shiftKey: true });
    key('keyup', { key: 'Shift', code: 'ShiftRight', shiftKey: true });
    expect(ended).toHaveBeenCalledTimes(1);
    key('keyup', { key: 'Shift', code: 'ShiftLeft' });
    expect(ended).toHaveBeenCalledTimes(2);
  });
});
