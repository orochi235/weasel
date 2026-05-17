/**
 * Coexistence tests: legacy ActionsRegistry keydown listener vs gesture dispatcher.
 *
 * Tests that:
 * 1. Without dispatcher mounted: legacy fires for any action with a defaultBinding.
 * 2. With dispatcher mounted: legacy is suppressed for actions with gestureBinding;
 *    only the new invoker path fires.
 * 3. With dispatcher mounted: actions WITHOUT gestureBinding still fire via legacy.
 *
 * See `docs/superpowers/specs/2026-05-16-registry-unification-design.md` § Q5.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useRef } from 'react';
import {
  ActionsProvider,
  useActionsRegistry,
  type Action,
} from '../actions/registry';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DispatcherPresenceProvider } from './dispatcherPresence';
import { useGestureDispatcher } from './useGestureDispatcher';

// ---------------------------------------------------------------------------
// Shared harness helpers
// ---------------------------------------------------------------------------

function BaseHarness({ children }: { children: React.ReactNode }) {
  return (
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>
          {children}
        </ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>
  );
}

/**
 * DispatcherPresenceProvider must wrap ActionsProvider so that ActionsProvider's
 * call to useIsDispatcherMounted() reads the context value correctly.
 * In production, SceneCanvas auto-wraps the entire subtree (Task 6).
 */
function DispatcherHarness({ children }: { children: React.ReactNode }) {
  return (
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <DispatcherPresenceProvider>
          <ActionsProvider>
            {children}
          </ActionsProvider>
        </DispatcherPresenceProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>
  );
}

function MountDispatcher() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const r = useActionsRegistry();
  useGestureDispatcher({ canvasRef: ref, actions: r!, toolsById: new Map() });
  return <canvas ref={ref} />;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('legacy coexistence', () => {
  it('without dispatcher: legacy document listener fires for action with gestureBinding', () => {
    const legacySpy = vi.fn();
    const action: Action = {
      id: 'coex.a',
      label: 'Coex A',
      defaultBinding: { key: 'a' },
      gestureBinding: { kind: 'key', key: 'a' },
      run: () => legacySpy(),
    };

    function Harness() {
      const r = useActionsRegistry();
      r?.register(action);
      return null;
    }

    render(
      <BaseHarness>
        <Harness />
      </BaseHarness>,
    );

    // Fire on document — reaches legacy ActionsProvider listener.
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true })); });
    expect(legacySpy).toHaveBeenCalledTimes(1);
  });

  it('with dispatcher mounted: legacy run is skipped; only invoker.run fires', () => {
    const legacyRunSpy = vi.fn();
    const invokerRunSpy = vi.fn();
    const action: Action = {
      id: 'coex.b',
      label: 'Coex B',
      defaultBinding: { key: 'b' },
      gestureBinding: { kind: 'key', key: 'b' },
      run: () => legacyRunSpy(),
      invoker: { timing: 'immediate', run: () => invokerRunSpy() },
    };

    function Harness() {
      const r = useActionsRegistry();
      r?.register(action);
      return <MountDispatcher />;
    }

    render(
      <DispatcherHarness>
        <Harness />
      </DispatcherHarness>,
    );

    // Fire on window — reaches the gesture dispatcher.
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' })); });
    expect(invokerRunSpy).toHaveBeenCalledTimes(1);

    // Fire on document — reaches legacy ActionsProvider listener, but should
    // be suppressed because dispatcher is mounted AND action has gestureBinding.
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true })); });
    expect(legacyRunSpy).not.toHaveBeenCalled();
  });

  it('with dispatcher mounted: action WITHOUT gestureBinding still fires via legacy', () => {
    const legacyRunSpy = vi.fn();
    const action: Action = {
      id: 'coex.c',
      label: 'Coex C',
      defaultBinding: { key: 'c' },
      // no gestureBinding — legacy path should remain active
      run: () => legacyRunSpy(),
    };

    function Harness() {
      const r = useActionsRegistry();
      r?.register(action);
      return <MountDispatcher />;
    }

    render(
      <DispatcherHarness>
        <Harness />
      </DispatcherHarness>,
    );

    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true })); });
    expect(legacyRunSpy).toHaveBeenCalledTimes(1);
  });
});
