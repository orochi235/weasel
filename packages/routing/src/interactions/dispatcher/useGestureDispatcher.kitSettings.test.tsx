import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { DOUBLE_CLICK_MAX_MS } from '@weasel-js/gestures';
import { KitSettingsProvider, useKitSettings, type KitSettingsOverrides, type KitSettingsStore, type WritableKitSettingsStore } from '@weasel-js/react';
import { useGestureDispatcher } from './useGestureDispatcher';
import { createLongPressStore, LONG_PRESS_MS } from '@weasel-js/gestures';
import type { LongPressOptions } from './longPressState';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider, useDepRegistry } from '../actions/depRegistry';
import type { DepRegistry } from '../actions/depNode';
import type { Action } from '../actions/action';
import type { Contribution } from '../../contributions/types';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';

function Mount({ onDoubleClick, longPress }: { onDoubleClick: () => void; longPress?: LongPressOptions }): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const actions = useActionsRegistry();
  useGestureDispatcher({
    canvasRef,
    actions: actions!,
    entriesById: new Map(),
    clientToWorld: (x, y) => ({ x, y }),
    onDoubleClick,
    ...(longPress ? { longPress } : {}),
  });
  return <canvas ref={canvasRef} data-testid="c" />;
}

function mount(settings: KitSettingsOverrides | null, onDoubleClick: () => void, longPress?: LongPressOptions): Element {
  const tree = (
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>
          <Mount onDoubleClick={onDoubleClick} {...(longPress ? { longPress } : {})} />
        </ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>
  );
  render(settings ? <KitSettingsProvider value={settings}>{tree}</KitSettingsProvider> : tree);
  return document.querySelector('[data-testid="c"]')!;
}

let now = 1000;
afterEach(() => { vi.restoreAllMocks(); });

/** Two clicks `gapMs` apart, timed on the recognizer's clock. */
function clicksApart(canvas: Element, gapMs: number): void {
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const press = (): void => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5, pointerId: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 5, clientY: 5, pointerId: 1 }));
  };
  act(() => {
    press();
    now += gapMs;
    press();
  });
}

describe('the dispatcher under a KitSettingsProvider', () => {
  it('recognizes a double click inside an overridden window', () => {
    const seen = vi.fn();
    clicksApart(mount({ gestures: { doubleClickMs: 900 } }, seen), DOUBLE_CLICK_MAX_MS + 100);
    expect(seen).toHaveBeenCalledOnce();
  });

  it('does not recognize one at the default interval when the override is shorter', () => {
    const seen = vi.fn();
    clicksApart(mount({ gestures: { doubleClickMs: 100 } }, seen), 200);
    expect(seen).not.toHaveBeenCalled();
  });

  it('uses the constant with no provider', () => {
    const seen = vi.fn();
    clicksApart(mount(null, seen), 200);
    expect(seen).toHaveBeenCalledOnce();
  });
});

describe('the long-press hold under a KitSettingsProvider', () => {
  const holdFor = (settings: KitSettingsOverrides | null, longPress: LongPressOptions): number | undefined => {
    const canvas = mount(settings, () => {}, longPress);
    act(() => {
      canvas.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, clientX: 5, clientY: 5, pointerId: 1, pointerType: 'touch',
      }));
    });
    return longPress.state?.get()?.duration;
  };

  it('takes gestures.longPressMs', () => {
    expect(holdFor({ gestures: { longPressMs: 250 } }, { state: createLongPressStore() })).toBe(250);
  });

  it('yields to an explicit longPress duration', () => {
    expect(holdFor({ gestures: { longPressMs: 250 } }, { duration: 300, state: createLongPressStore() })).toBe(300);
  });

  it('uses the constant with no provider', () => {
    expect(holdFor(null, { state: createLongPressStore() })).toBe(LONG_PRESS_MS);
  });
});

describe('gestures.keymapUnbound', () => {
  const LOUPE: Contribution = { id: 'loupe', eligibility: { keymap: true }, bindings: [] };
  const ENTRIES = new Map([[LOUPE.id, LOUPE]]);

  function KeymapMount({ run, reach }: { run: () => void; reach: (s: KitSettingsStore, d: DepRegistry) => void }): ReactNode {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const actions = useActionsRegistry()!;
    reach(useKitSettings(), useDepRegistry());
    useEffect(() => actions.register({
      id: 'test.three', label: 'Three', defaultBinding: { kind: 'key', key: '3' },
      invoker: { timing: 'immediate', run: () => run() },
    } satisfies Action), [actions, run]);
    useGestureDispatcher({ canvasRef, actions, entriesById: ENTRIES, claimKeys: true });
    return <canvas ref={canvasRef} />;
  }

  it('is read as each key arrives, not when the host last rendered', () => {
    const run = vi.fn();
    let store: KitSettingsStore | undefined;
    let deps: DepRegistry | undefined;
    render(
      <KitSettingsProvider value={{ gestures: { keymapUnbound: 'modal' } }}>
        <DepRegistryProvider>
          <ActiveToolContextProvider>
            <ActionsProvider>
              <KeymapMount run={run} reach={(s, d) => { store = s; deps = d; }} />
            </ActionsProvider>
          </ActiveToolContextProvider>
        </DepRegistryProvider>
      </KitSettingsProvider>,
    );
    act(() => { (store as WritableKitSettingsStore).set({ gestures: { keymapUnbound: 'cascade' } }); });
    act(() => { deps!.get('keymaps')!.push('loupe', 'Loupe'); });
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: '3', code: 'Digit3', cancelable: true })); });
    expect(run).toHaveBeenCalledOnce();
  });
});
