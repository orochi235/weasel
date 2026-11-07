/**
 * A modifier key's own keydown reports its flag set (`altKey: true` for Alt),
 * so an entry held on a modifier is driven here by events shaped the way a
 * browser sends them, never by seeding the hotkey stack.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useMemo, useRef, type ReactNode } from 'react';
import { useContributions } from './useContributions';
import type { Contribution, HotkeyTrigger } from './types';
import {
  ActiveToolContextProvider,
  useActiveToolContext,
  type ActiveToolContextValue,
} from '../interactions/actions/activeToolContext';
import { DepRegistryProvider, useDepSource } from '../interactions/actions/depRegistry';
import { useGestureDispatcher } from '../interactions/dispatcher/useGestureDispatcher';
import { ActionsProvider, useAction, useActionsRegistry } from '../interactions/actions/ActionsProvider';
import type { Action } from '../interactions/actions/action';

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

function Mount({ entries, onCtx, actions = [], focused = 'select' }: {
  entries: Contribution[];
  focused?: string;
  onCtx: (v: ActiveToolContextValue) => void;
  actions?: readonly Action[];
}): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const registry = useActionsRegistry();
  onCtx(useActiveToolContext());
  useContributions({ entries, focused });
  const entriesById = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  useGestureDispatcher({ canvasRef, actions: registry!, entriesById });
  return <>{actions.map((a) => <Registered key={a.id} action={a} />)}<canvas ref={canvasRef} /></>;
}

function Registered({ action }: { action: Action }): ReactNode {
  useAction(action);
  return null;
}

function mount(entries: Contribution[], actions: readonly Action[] = [], focused?: string): () => readonly string[] {
  let ctx!: ActiveToolContextValue;
  render(
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>
          <ActiveToolDepSource />
          <Mount entries={entries} actions={actions} {...(focused ? { focused } : {})} onCtx={(v) => { ctx = v; }} />
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

beforeAll(() => {
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.releasePointerCapture = vi.fn();
});

const logged = (id: string, log: string[]): Action => ({
  id, label: id, invoker: { timing: 'immediate', run: () => { log.push(id); } },
});

/** A press and release in place on the canvas, with `flags` held. */
const clickWith = (flags: Partial<typeof FLAGS>): void => {
  const canvas = document.querySelector('canvas')!;
  act(() => {
    for (const type of ['pointerdown', 'pointerup']) {
      canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: 5, clientY: 5, pointerId: 1, ...FLAGS, ...flags }));
    }
  });
};

describe('the gestures of an entry held on a modifier', () => {
  const clicker = (offhand: HotkeyTrigger, mods?: Record<string, boolean | 'optional'>): Contribution => ({
    id: 'picker',
    eligibility: { focus: true, offhand },
    bindings: [{ spec: { kind: 'click', ...(mods ? { mods } : {}) }, actionId: 'picker.click' }],
  });

  it('take that modifier down on a binding that names no modifiers', () => {
    const log: string[] = [];
    const stack = mount([clicker('shift')], [logged('picker.click', log)]);
    key('keydown', { key: 'Shift', code: 'ShiftLeft', shiftKey: true });
    expect(stack()).toEqual(['picker']);
    clickWith({ shiftKey: true });
    expect(log).toEqual(['picker.click']);
  });

  it('still refuse a modifier other than the one holding the entry', () => {
    const log: string[] = [];
    mount([clicker('shift')], [logged('picker.click', log)]);
    key('keydown', { key: 'Shift', code: 'ShiftLeft', shiftKey: true });
    clickWith({ shiftKey: true, altKey: true });
    expect(log).toEqual([]);
  });

  it('still refuse it on a binding that excludes it outright', () => {
    const log: string[] = [];
    mount([clicker('alt', { alt: false })], [logged('picker.click', log)]);
    key('keydown', { key: 'Alt', code: 'AltLeft', altKey: true });
    clickWith({ altKey: true });
    expect(log).toEqual([]);
  });

  it('stay strict while the entry is the active tool rather than held', () => {
    const log: string[] = [];
    const stack = mount([clicker('shift')], [logged('picker.click', log)], 'picker');
    clickWith({ shiftKey: true });
    expect(stack()).toEqual([]);
    expect(log).toEqual([]);
    clickWith({});
    expect(log).toEqual(['picker.click']);
  });
});
