/**
 * SceneCanvas — auto-mounted gesture dispatcher (Phase 3 Task 6).
 *
 * Verifies that <SceneCanvas> auto-mounts `useGestureDispatcher` so
 * registered actions with a `gestureBinding` fire on window keydown,
 * and that `enableGestureDispatcher={false}` opts out cleanly.
 *
 * Phase 8 safety tests: confirm delete/duplicate/nudge/undo keybindings fire
 * through the dispatcher path BEFORE deleting the wrapper tools.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { useEffect } from 'react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { Scene } from 'core/scene/types';
import { useActionsRegistry, type Action } from 'interactions/actions/registry';

type D = { kind: 'rect' };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => ({
    canvas: { width: 0, height: 0 },
    clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), setTransform: vi.fn(),
    scale: vi.fn(), setLineDash: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), arc: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
    fillText: vi.fn(), measureText: vi.fn(() => ({ width: 10 })),
    font: '', textBaseline: '', globalAlpha: 1,
    fillStyle: '', strokeStyle: '', lineWidth: 1,
  } as unknown as CanvasRenderingContext2D));
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

/** Registers a custom action inside the SceneCanvas's ActionsProvider scope. */
function ActionRegistrar({ action }: { action: Action }) {
  const registry = useActionsRegistry();
  useEffect(() => {
    if (!registry) return;
    return registry.register(action);
  }, [registry, action]);
  return null;
}

describe('SceneCanvas auto-mounted gesture dispatcher', () => {
  it('registered action with gestureBinding fires on window keydown when mounted inside SceneCanvas', () => {
    const spy = vi.fn();
    const action: Action = {
      id: 'test.dispatcher',
      label: 'Test dispatcher',
      gestureBinding: { kind: 'key', key: 'q' },
      run: spy,
    };
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });

    render(
      <SceneCanvas scene={scene} layers={{}} width={64} height={64}>
        <ActionRegistrar action={action} />
      </SceneCanvas>,
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', bubbles: true }));
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('with enableGestureDispatcher=false, the dispatcher does NOT fire the action', () => {
    const spy = vi.fn();
    const action: Action = {
      id: 'test.dispatcher.disabled',
      label: 'Test dispatcher disabled',
      gestureBinding: { kind: 'key', key: 'q' },
      run: spy,
    };
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });

    render(
      <SceneCanvas scene={scene} layers={{}} width={64} height={64} enableGestureDispatcher={false}>
        <ActionRegistrar action={action} />
      </SceneCanvas>,
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', bubbles: true }));
    });

    // Dispatcher opted out — action has no `defaultBinding`, so legacy path also
    // skips it. The spy must not have been called.
    expect(spy).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Phase 8 safety: verify delete/duplicate/nudge/undo fire via dispatcher
  // BEFORE the wrapper tools are deleted.
  // -------------------------------------------------------------------------

  type D8 = { kind: 'rect' };
  type L8 = 'main';
  type P8 = { x: number; y: number; width: number; height: number };

  function makeSceneWithNode(): Scene<D8, L8, P8> {
    const s = createScene<D8, L8, P8>({ systemLayers: [{ id: 'main' }] });
    s.batch('seed', () => {
      s.add({ kind: 'leaf', data: { kind: 'rect' }, layer: 'main' as L8, pose: { x: 0, y: 0, width: 10, height: 10 } as P8 });
    });
    return s;
  }

  it('Phase 8: Backspace fires deleteAction bridge run via dispatcher', () => {
    const scene = makeSceneWithNode();
    const deleteSpy = vi.fn();
    // enabled:()=>true bypasses the selection guard so the dispatcher runs the
    // action even without an active selection — verifies routing, not business logic.
    render(
      <SceneCanvas scene={scene} layers={{}} width={64} height={64}
        actions={{ delete: { run: deleteSpy, enabled: () => true } }} />,
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
    });
    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });

  it('Phase 8: Delete fires deleteAction bridge run via dispatcher', () => {
    const scene = makeSceneWithNode();
    const deleteSpy = vi.fn();
    render(
      <SceneCanvas scene={scene} layers={{}} width={64} height={64}
        actions={{ delete: { run: deleteSpy, enabled: () => true } }} />,
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
    });
    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });

  it('Phase 8: Ctrl+D fires duplicateAction run via dispatcher (jsdom is not Mac)', () => {
    const scene = makeSceneWithNode();
    const dupSpy = vi.fn();
    render(
      <SceneCanvas scene={scene} layers={{}} width={64} height={64}
        actions={{ duplicate: { run: dupSpy, enabled: () => true } }} />,
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true }));
    });
    expect(dupSpy).toHaveBeenCalledTimes(1);
  });

  it('Phase 8: ArrowUp fires nudgeUpAction run via dispatcher', () => {
    const scene = makeSceneWithNode();
    const nudgeSpy = vi.fn();
    // nudge descriptor id is "nudge.up" (not "nudge.up.small")
    render(
      <SceneCanvas scene={scene} layers={{}} width={64} height={64}
        actions={{ 'nudge.up': { run: nudgeSpy, enabled: () => true } }} />,
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    });
    expect(nudgeSpy).toHaveBeenCalledTimes(1);
  });

  it('Phase 8: Ctrl+Z fires undoAction run via dispatcher', () => {
    const scene = makeSceneWithNode();
    const undoSpy = vi.fn();
    render(
      <SceneCanvas scene={scene} layers={{}} width={64} height={64}
        actions={{ undo: { run: undoSpy } }} />,
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    });
    expect(undoSpy).toHaveBeenCalledTimes(1);
  });

  it('Phase 8: Ctrl+Shift+Z fires redoAction run via dispatcher', () => {
    const scene = makeSceneWithNode();
    const redoSpy = vi.fn();
    render(
      <SceneCanvas scene={scene} layers={{}} width={64} height={64}
        actions={{ redo: { run: redoSpy } }} />,
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true }));
    });
    expect(redoSpy).toHaveBeenCalledTimes(1);
  });

  it('action with invoker.run fires invoker (not legacy run) via dispatcher', () => {
    const runSpy = vi.fn();
    const invokerSpy = vi.fn();
    const action: Action = {
      id: 'test.invoker',
      label: 'Test invoker',
      gestureBinding: { kind: 'key', key: 'j' },
      run: runSpy,
      invoker: { timing: 'immediate', run: () => invokerSpy() },
    };
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });

    render(
      <SceneCanvas scene={scene} layers={{}} width={64} height={64}>
        <ActionRegistrar action={action} />
      </SceneCanvas>,
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }));
    });

    expect(invokerSpy).toHaveBeenCalledTimes(1);
    // `run` is the legacy fallback; with an invoker present, it must NOT fire.
    expect(runSpy).not.toHaveBeenCalled();
  });
});
