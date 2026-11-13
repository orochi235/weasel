/**
 * macOS sends no keyup for a key released while Cmd is down, so Cmd's own
 * keyup is the last word on a key that went down with it.
 */
import { describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useRef, type ReactNode } from 'react';
import { useGestureDispatcher } from './useGestureDispatcher';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useAction, useActionsRegistry } from '../actions/ActionsProvider';
import type { Action } from '../actions/action';

function mount(): string[] {
  const log: string[] = [];
  const hold: Action = {
    id: 'test.cmdHold', label: 'hold', defaultBinding: { kind: 'keyHeld', key: 'h', mods: { meta: true } },
    invoker: {
      timing: 'ongoing',
      start: () => { log.push('start'); return { onEnd: () => { log.push('end'); } }; },
    },
  };
  function Mount(): ReactNode {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const registry = useActionsRegistry();
    useAction(hold);
    useGestureDispatcher({ canvasRef, actions: registry!, entriesById: new Map() });
    return <canvas ref={canvasRef} />;
  }
  render(
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider><Mount /></ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>,
  );
  return log;
}

const key = (type: 'keydown' | 'keyup', init: KeyboardEventInit): void => {
  act(() => { window.dispatchEvent(new KeyboardEvent(type, init)); });
};

describe('a key held with Cmd', () => {
  it('is released by Cmd coming up, when its own keyup never arrives', () => {
    const log = mount();
    key('keydown', { key: 'Meta', code: 'MetaLeft', metaKey: true });
    key('keydown', { key: 'h', code: 'KeyH', metaKey: true });
    expect(log).toEqual(['start']);
    key('keyup', { key: 'Meta', code: 'MetaLeft' });
    expect(log).toEqual(['start', 'end']);
  });

  it('is released once, when its keyup does arrive', () => {
    const log = mount();
    key('keydown', { key: 'Meta', code: 'MetaLeft', metaKey: true });
    key('keydown', { key: 'h', code: 'KeyH', metaKey: true });
    key('keyup', { key: 'h', code: 'KeyH', metaKey: true });
    key('keyup', { key: 'Meta', code: 'MetaLeft' });
    expect(log).toEqual(['start', 'end']);
  });
});
