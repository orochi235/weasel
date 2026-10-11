/**
 * A modifier key's own keydown reports its flag set (`altKey: true` for Alt),
 * so an entry held on a modifier is driven here by events shaped the way a
 * browser sends them, never by seeding the hotkey stack.
 */
import { describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useRef, type ReactNode } from 'react';
import { useContributions } from './useContributions';
import type { Contribution, HotkeyTrigger } from './types';
import {
  ActiveToolContextProvider,
  useActiveToolContext,
  type ActiveToolContextValue,
} from '../interactions/actions/activeToolContext';
import { DepRegistryProvider, useDepSource } from '../interactions/actions/depRegistry';
import { useGestureDispatcher } from '../interactions/dispatcher/useGestureDispatcher';
import { ActionsProvider, useActionsRegistry } from '../interactions/actions/ActionsProvider';

const entry = (id: string, offhand: HotkeyTrigger): Contribution => ({
  id,
  eligibility: { focus: true, offhand },
  bindings: [{ spec: { kind: 'drag' }, actionId: `${id}.drag` }],
});

function ActiveToolDepSource(): ReactNode {
  const ctx = useActiveToolContext();
  useDepSource('activeTool', () => ctx);
  return null;
}

function Mount({ entries, onCtx }: {
  entries: Contribution[];
  onCtx: (v: ActiveToolContextValue) => void;
}): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const registry = useActionsRegistry();
  onCtx(useActiveToolContext());
  useContributions({ entries, focused: 'select' });
  useGestureDispatcher({ canvasRef, actions: registry!, entriesById: new Map() });
  return <canvas ref={canvasRef} />;
}

function mount(entries: Contribution[]): () => readonly string[] {
  let ctx!: ActiveToolContextValue;
  render(
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>
          <ActiveToolDepSource />
          <Mount entries={entries} onCtx={(v) => { ctx = v; }} />
        </ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>,
  );
  return () => ctx.hotkeyStack;
}

const FLAGS = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
const key = (type: 'keydown' | 'keyup', init: KeyboardEventInit): void => {
  act(() => { window.dispatchEvent(new KeyboardEvent(type, { ...FLAGS, ...init })); });
};

describe('an entry held on a modifier key', () => {
  it.each([
    ['alt', 'Alt', 'AltLeft', { altKey: true }],
    ['shift', 'Shift', 'ShiftLeft', { shiftKey: true }],
    ['ctrl', 'Control', 'ControlLeft', { ctrlKey: true }],
    ['meta', 'Meta', 'MetaLeft', { metaKey: true }],
  ] as const)('engages while %s is down and releases on keyup', (trigger, name, code, flag) => {
    const stack = mount([entry('eyedropper', trigger)]);
    key('keydown', { key: name, code, ...flag });
    expect(stack()).toEqual(['eyedropper']);
    key('keyup', { key: name, code });
    expect(stack()).toEqual([]);
  });

  it('engages with another modifier already down', () => {
    const stack = mount([entry('constrain', 'shift'), entry('eyedropper', 'alt')]);
    key('keydown', { key: 'Shift', code: 'ShiftLeft', shiftKey: true });
    key('keydown', { key: 'Alt', code: 'AltLeft', shiftKey: true, altKey: true });
    expect(stack()).toEqual(['constrain', 'eyedropper']);
    key('keyup', { key: 'Alt', code: 'AltLeft', shiftKey: true });
    key('keyup', { key: 'Shift', code: 'ShiftLeft' });
    expect(stack()).toEqual([]);
  });

  it('leaves a held letter strict about modifiers', () => {
    const stack = mount([entry('zoom', 'z')]);
    key('keydown', { key: 'z', code: 'KeyZ', metaKey: true });
    expect(stack()).toEqual([]);
    key('keyup', { key: 'z', code: 'KeyZ', metaKey: true });
    key('keydown', { key: 'z', code: 'KeyZ' });
    expect(stack()).toEqual(['zoom']);
  });
});
