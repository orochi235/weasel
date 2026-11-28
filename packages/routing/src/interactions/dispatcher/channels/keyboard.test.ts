import { describe, expect, it } from 'vitest';
import type { DispatchCore } from '../dispatchCore';
import type { KeyReach } from '../dispatcherApi';
import type { InputEvent } from '../matcher';
import { keyHeldGestureId } from '../gestureIds';
import { keyboardInput } from './keyboard';

interface Call { ev: InputEvent; reach: KeyReach | undefined }

/** A keyboard channel over a stand-in core whose dispatcher takes what `takes` accepts. */
function channel(opts: { held?: boolean; over?: boolean; takes?: (ev: InputEvent) => boolean } = {}) {
  const inFlight = new Map<string, unknown>();
  const on = { inFlight: () => inFlight };
  const calls: Call[] = [];
  const dispatch = (ev: InputEvent, _on: unknown, reach?: KeyReach): 'handled' | 'unhandled' => {
    calls.push({ ev, reach });
    if (ev.kind === 'keyHeld') {
      const id = keyHeldGestureId(ev.key, ev.code);
      if (ev.phase === 'up') return inFlight.delete(id) ? 'handled' : 'unhandled';
      if (inFlight.has(id)) return 'handled';
    }
    if (!opts.takes?.(ev)) return 'unhandled';
    if (ev.kind === 'keyHeld') inFlight.set(keyHeldGestureId(ev.key, ev.code), {});
    return 'handled';
  };
  const core = {
    dispatch, dispatcherNow: () => on, holdsKeys: () => opts.held ?? true, pointerOver: () => opts.over ?? false,
    canvas: null, batch: <T>(fn: () => T) => fn(), keymaps: () => undefined,
    routedView: () => null, setRoutedView: () => {}, routeAt: () => {},
  } as unknown as DispatchCore;
  return { input: keyboardInput(core), calls, inFlight };
}

const keydown = (init: KeyboardEventInit) => new KeyboardEvent('keydown', { cancelable: true, ...init });
const SPACE = { key: ' ', code: 'Space' };
const holdsSpace = (ev: InputEvent) => ev.kind === 'keyHeld' && ev.code === 'Space';

describe('keyboardInput', () => {
  it('leaves a character AltGr typed in a text field to the field', () => {
    const field = document.body.appendChild(document.createElement('input'));
    const { input, calls } = channel({ takes: () => true });
    field.addEventListener('keydown', input.onKeyDown);
    const e = keydown({ key: '@', code: 'KeyQ', ctrlKey: true, altKey: true, bubbles: true });
    Object.defineProperty(e, 'getModifierState', { value: (k: string) => k === 'AltGraph' });
    field.dispatchEvent(e);
    field.remove();
    expect(calls).toEqual([]);
    expect(e.defaultPrevented).toBe(false);
  });

  it('asks its `over` bindings once when a peer hands on a keystroke its own listener already offered them', () => {
    const { input, calls } = channel({ held: false, over: true });
    const e = keydown({ key: 'a', code: 'KeyA' });
    input.onKeyDown(e);
    input.take(e);
    expect(calls.filter((c) => c.reach?.over)).toHaveLength(2);
    expect(calls.filter((c) => c.reach?.held)).toHaveLength(2);
  });

  it('presses a held key again on autorepeat once something other than its keyup ended its gesture', () => {
    const { input, calls, inFlight } = channel({ takes: holdsSpace });
    input.onKeyDown(keydown(SPACE));
    inFlight.clear();
    const before = calls.length;
    input.onKeyDown(keydown({ ...SPACE, repeat: true }));
    expect(calls.length).toBeGreaterThan(before);
    expect(inFlight.has(keyHeldGestureId(' ', 'Space'))).toBe(true);
  });

  it('releases a key pressed before Cmd when Cmd comes up, as its own keyup may never arrive', () => {
    const { input, inFlight } = channel({ takes: holdsSpace });
    input.onKeyDown(keydown(SPACE));
    input.onKeyDown(keydown({ key: 'Meta', code: 'MetaLeft', metaKey: true }));
    input.onKeyUp(new KeyboardEvent('keyup', { key: 'Meta', code: 'MetaLeft' }));
    expect(inFlight.size).toBe(0);
  });
});
