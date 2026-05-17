/**
 * SceneCanvas — auto-mounted gesture dispatcher (Phase 3 Task 6).
 *
 * Verifies that <SceneCanvas> auto-mounts `useGestureDispatcher` so
 * registered actions with a `gestureBinding` fire on window keydown,
 * and that `enableGestureDispatcher={false}` opts out cleanly.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { useEffect } from 'react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
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
