/** A keymap and its leader, end to end through the dispatcher hook and window keys. */
import { describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useEffect, useRef } from 'react';
import { key } from '@weasel-js/gestures';
import { ActionsProvider, useActionsRegistry } from '../interactions/actions/ActionsProvider';
import type { ActionsRegistry } from '../interactions/actions/registry';
import { ActiveToolContextProvider } from '../interactions/actions/activeToolContext';
import { DepRegistryProvider } from '../interactions/actions/depRegistry';
import type { Action } from '../interactions/actions/action';
import type { BindingOverrides } from '../interactions/actions/bindingOverrides';
import { useGestureDispatcher } from '../interactions/dispatcher/useGestureDispatcher';
import { keymapContribution, type KeymapDef } from './keymapContribution';
import { createKeymapStack } from './keymapStack';
import { createDispatcher } from '../interactions/dispatcher/dispatcher';
import type { InputEvent } from '../interactions/dispatcher/matcher';
import { makeCtx, makeDepRegistry, makeRegistry } from '../interactions/dispatcher/testing/dispatcherStubs';

function Probe({ def, outside, overrides, onRegistry }: {
  def: KeymapDef; outside: Action; overrides?: BindingOverrides; onRegistry?: (r: ActionsRegistry) => void;
}) {
  const registry = useActionsRegistry()!;
  onRegistry?.(registry);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const entries = keymapContribution(def);
  useEffect(() => {
    const releases = [outside, ...entries.flatMap((e) => e.actions ?? [])].map((a) => registry.register(a));
    const off = overrides ? registry.overrideBindings(overrides) : () => {};
    return () => { off(); for (const r of releases) r(); };
  });
  useGestureDispatcher({ canvasRef, actions: registry, entriesById: new Map(entries.map((e) => [e.id, e])) });
  return <canvas ref={canvasRef} />;
}

function mount(overrides?: BindingOverrides) {
  const inside = vi.fn();
  const outside = vi.fn();
  let registry: ActionsRegistry | undefined;
  const def: KeymapDef = {
    id: 'loupe',
    label: 'Loupe',
    leader: [key('l'), key('Meta+j')],
    bindings: [{ spec: key('2'), actionId: 'zoom' }, { spec: key('@'), actionId: 'zoom' }],
    actions: [{ id: 'zoom', label: 'Zoom', invoker: { timing: 'immediate', run: inside } }],
  };
  const outsideAction: Action = {
    id: 'outside', label: 'outside', defaultBinding: [key('2'), key('l')],
    invoker: { timing: 'immediate', run: outside },
  };
  render(
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>
          <Probe def={def} outside={outsideAction} onRegistry={(r) => { registry = r; }} {...(overrides ? { overrides } : {})} />
        </ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>,
  );
  const send = (type: 'keydown' | 'keyup', k: string, init: KeyboardEventInit = {}) => {
    act(() => { window.dispatchEvent(new KeyboardEvent(type, { key: k, code: `Key${k.toUpperCase()}`, ...init })); });
  };
  const tap = (k: string) => { send('keydown', k); send('keyup', k); };
  const trigger = (params?: Record<string, unknown>) => { act(() => { registry!.trigger('keymap.loupe', params); }); };
  return { inside, outside, send, tap, trigger };
}

describe('a leader mid-gesture', () => {
  it('opens its keymap without ending the drag in flight', () => {
    const stack = createKeymapStack();
    const onMove = vi.fn();
    const onEnd = vi.fn();
    const drag: Action = {
      id: 'drag', label: 'drag', defaultBinding: { kind: 'drag' },
      invoker: { timing: 'ongoing', start: () => ({ onMove, onEnd }) },
    };
    const entries = keymapContribution({
      id: 'loupe', label: 'Loupe', leader: key('l'), bindings: [{ spec: key('2'), actionId: 'zoom' }],
    });
    const zoom = vi.fn();
    const actions = [drag, ...entries.flatMap((e) => e.actions ?? []),
      { id: 'zoom', label: 'Zoom', invoker: { timing: 'immediate' as const, run: zoom } }];
    const ctx = makeCtx({
      actions: makeRegistry(actions),
      entriesById: new Map(entries.map((e) => [e.id, e])),
      depRegistry: makeDepRegistry({ keymaps: stack }),
      keymaps: stack,
    });
    const d = createDispatcher();
    const mods = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
    const p = { pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, x: 0, y: 0, clientX: 0, clientY: 0, ...mods };
    stack.batch(() => d.handleInput({ kind: 'pointerdown', ...p } as InputEvent, ctx));
    stack.batch(() => d.handleInput({ kind: 'key', key: 'l', ...mods }, ctx));
    expect(stack.open().map((k) => k.id)).toEqual(['loupe']);
    stack.batch(() => d.handleInput({ kind: 'pointermove', ...p, x: 5 } as InputEvent, ctx));
    expect(stack.open().map((k) => k.id)).toEqual(['loupe']);
    stack.batch(() => d.handleInput({ kind: 'key', key: '2', ...mods }, ctx));
    expect(zoom).toHaveBeenCalledOnce();
    stack.batch(() => d.handleInput({ kind: 'pointerup', ...p } as InputEvent, ctx));
    expect(onMove).toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledWith(expect.anything(), 'commit');
  });
});

describe('keymapContribution', () => {
  it('a tapped leader opens the keymap for the next key, and only the leader sees its own key', () => {
    const { inside, outside, tap } = mount();
    tap('l');
    expect(outside).not.toHaveBeenCalled();
    tap('2');
    expect(inside).toHaveBeenCalledOnce();
    tap('2');
    expect(outside).toHaveBeenCalledOnce();
  });

  it('a held leader keeps the keymap open until it comes up', () => {
    const { inside, outside, send, tap } = mount();
    send('keydown', 'l');
    tap('2');
    tap('2');
    send('keyup', 'l');
    expect(inside).toHaveBeenCalledTimes(2);
    tap('2');
    expect(outside).toHaveBeenCalledOnce();
  });

  it("does not count the leader's own autorepeat as input", () => {
    const { inside, send, tap } = mount();
    send('keydown', 'l');
    send('keydown', 'l', { repeat: true });
    send('keyup', 'l');
    tap('2');
    expect(inside).toHaveBeenCalledOnce();
  });

  it('a leader triggered without a key is tapped: it opens the keymap for one input', () => {
    const { inside, outside, tap, trigger } = mount();
    trigger();
    tap('2');
    tap('2');
    expect(inside).toHaveBeenCalledOnce();
    expect(outside).toHaveBeenCalledOnce();
  });

  it('a leader triggered with `hold` keeps the keymap open until Escape', () => {
    const { inside, outside, tap, trigger } = mount();
    trigger({ hold: true });
    tap('2');
    tap('2');
    tap('2');
    expect(inside).toHaveBeenCalledTimes(3);
    tap('Escape');
    tap('2');
    expect(outside).toHaveBeenCalledOnce();
  });

  it('closes on window blur', () => {
    const { outside, tap } = mount();
    tap('l');
    act(() => { window.dispatchEvent(new Event('blur')); });
    tap('2');
    expect(outside).toHaveBeenCalledOnce();
  });

  it('rebinds the leader by its binding id', () => {
    const { inside, tap } = mount({ 'keymap.loupe.leader': key('m') });
    tap('m');
    tap('2');
    expect(inside).toHaveBeenCalledOnce();
  });

  it('refuses a keymap that binds Escape', () => {
    expect(() => keymapContribution({
      id: 'k', label: 'K', leader: key('k'), bindings: [{ spec: key('Escape'), actionId: 'x' }],
    })).toThrow(/binds Escape/);
  });

  it('releases a Cmd leader when Cmd comes up, since macOS sends no keyup for the key', () => {
    const { inside, outside, send, tap } = mount();
    send('keydown', 'Meta', { metaKey: true, code: 'MetaLeft' });
    send('keydown', 'j', { metaKey: true });
    send('keyup', 'Meta', { code: 'MetaLeft' });
    tap('2');
    tap('2');
    expect(inside).toHaveBeenCalledOnce();
    expect(outside).toHaveBeenCalledOnce();
  });

  it('drops the autorepeat of a key that closed the keymap, rather than handing it outside', () => {
    const { inside, outside, send } = mount();
    send('keydown', 'l');
    send('keyup', 'l');
    send('keydown', '2');
    send('keydown', '2', { repeat: true });
    send('keyup', '2');
    expect(inside).toHaveBeenCalledOnce();
    expect(outside).not.toHaveBeenCalled();
  });

  it('takes a character typed through AltGr', () => {
    const { inside, tap, send } = mount();
    tap('l');
    send('keydown', '@', { code: 'KeyQ', ctrlKey: true, altKey: true, modifierAltGraph: true } as KeyboardEventInit);
    expect(inside).toHaveBeenCalledOnce();
  });
});
