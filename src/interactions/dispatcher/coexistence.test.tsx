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
import { useGestureDispatcher } from './useGestureDispatcher';

// ---------------------------------------------------------------------------
// Shared harness helpers
// ---------------------------------------------------------------------------

/**
 * Phase 14e Task 2.6: dispatcher presence is now unconditional — no
 * provider needed. ActionsProvider always assumes the dispatcher is mounted.
 */
function DispatcherHarness({ children }: { children: React.ReactNode }) {
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
  // REMOVED (Phase 14e Task 2.6): 'without dispatcher: legacy document
  // listener fires for action with gestureBinding'. The dispatcher is now
  // unconditionally present — there is no "without dispatcher" path to test.

  it('with dispatcher mounted: legacy run is skipped; only invoker.run fires', () => {
    const legacyRunSpy = vi.fn();
    const invokerRunSpy = vi.fn();
    const action: Action = {
      id: 'coex.b',
      label: 'Coex B',
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

  // REMOVED (Phase 14e Task 7): 'with dispatcher mounted: action WITHOUT
  // gestureBinding still fires via legacy'. The legacy keystroke loop in
  // registry.tsx is gone — actions without a gestureBinding no longer have
  // a keystroke path through the registry. Consumer-facing hooks
  // (useEscape, useClipboard, ...) own their own document keydown via
  // `useKeybinding`.
});
