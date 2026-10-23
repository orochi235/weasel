/**
 * <SceneCanvas> auto-mounts the gesture dispatcher, so registered actions with
 * a `defaultBinding` fire on window keydown, and `enableGestureDispatcher={false}`
 * opts out. Also covers the `insert` dep's wiring.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useEffect, useRef } from 'react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { Scene } from 'core/scene/types';
import { useActionsRegistry } from '@weasel-js/routing/react';
import type { Action } from '@weasel-js/routing';
import { useDepRegistry } from '@weasel-js/routing/react';
import type { InsertDep } from 'interactions/actions/depSchema';

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
  it('registered action with defaultBinding fires on window keydown when mounted inside SceneCanvas', () => {
    const spy = vi.fn();
    const action: Action = {
      id: 'test.dispatcher',
      label: 'Test dispatcher',
      defaultBinding: { kind: 'key', key: 'q' },
      invoker: { timing: 'immediate' as const, run: () => { spy(); } },
    };
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });

    render(
      <SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64}>
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
      defaultBinding: { kind: 'key', key: 'q' },
      invoker: { timing: 'immediate' as const, run: () => { spy(); } },
    };
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });

    render(
      <SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64} enableGestureDispatcher={false}>
        <ActionRegistrar action={action} />
      </SceneCanvas>,
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', bubbles: true }));
    });

    expect(spy).not.toHaveBeenCalled();
  });

  type D8 = { kind: 'rect' };
  type L8 = 'main';
  type P8 = { x: number; y: number; width: number; height: number };

  function makeSceneWithNode(): Scene<D8, L8, P8> {
    const s = createScene<D8, L8, P8>({ systemLayers: [{ id: 'main' }] });
    s.batch('seed', () => {
      s.add({ kind: 'mark', data: { kind: 'rect' }, layer: 'main' as L8, pose: { x: 0, y: 0, width: 10, height: 10 } as P8 });
    });
    return s;
  }

  it('Backspace fires deleteAction bridge run via dispatcher', () => {
    const scene = makeSceneWithNode();
    const deleteSpy = vi.fn();
    // enabled:()=>true bypasses the selection guard so the dispatcher runs the
    // action even without an active selection — verifies routing, not business logic.
    render(
      <SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64}
        actions={{ delete: { invoker: { timing: 'immediate' as const, run: () => { deleteSpy(); } }, enabled: () => true } }} />,
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
    });
    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });

  it('Delete fires deleteAction bridge run via dispatcher', () => {
    const scene = makeSceneWithNode();
    const deleteSpy = vi.fn();
    render(
      <SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64}
        actions={{ delete: { invoker: { timing: 'immediate' as const, run: () => { deleteSpy(); } }, enabled: () => true } }} />,
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
    });
    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });

  it('ArrowUp fires nudgeUpAction run via dispatcher', () => {
    const scene = makeSceneWithNode();
    const nudgeSpy = vi.fn();
    // nudge descriptor id is "nudge.up" (not "nudge.up.small")
    render(
      <SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64}
        actions={{ 'nudge.up': { invoker: { timing: 'immediate' as const, run: () => { nudgeSpy(); } }, enabled: () => true } }} />,
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    });
    expect(nudgeSpy).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Z fires undoAction run via dispatcher', () => {
    const scene = makeSceneWithNode();
    const undoSpy = vi.fn();
    render(
      <SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64}
        actions={{ undo: { invoker: { timing: 'immediate' as const, run: () => { undoSpy(); } } } }} />,
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    });
    expect(undoSpy).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Shift+Z fires redoAction run via dispatcher', () => {
    const scene = makeSceneWithNode();
    // Redo is disabled with nothing to redo, so put the seed batch on the redo stack.
    scene.undo();
    const redoSpy = vi.fn();
    render(
      <SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64}
        actions={{ redo: { invoker: { timing: 'immediate' as const, run: () => { redoSpy(); } } } }} />,
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true }));
    });
    expect(redoSpy).toHaveBeenCalledTimes(1);
  });
});

describe('insertDep wired in SceneCanvas', () => {
  /**
   * These call the `insert` dep's `commit` directly, from a child inside
   * `<SceneCanvas>`, and assert the scene node it creates. The drag that
   * reaches `commit` through the gesture dispatcher is not exercised here.
   */

  type D14 = { path: unknown; fill: string };
  type L14 = 'main';
  type P14 = { x: number; y: number; width: number; height: number };

  function makeEmptyScene() {
    return createScene<D14, L14, P14>({ systemLayers: [{ id: 'main' }] });
  }

  /** Reads the dep registry at effect time and hands out the `insert` dep's commit. */
  function DepHarness({ onDepReady }: { onDepReady: (commit: InsertDep['commit']) => void }) {
    const registry = useDepRegistry();
    const notified = useRef(false);
    useEffect(() => {
      if (notified.current) return;
      notified.current = true;
      const dep = registry.get('insert' as const) as InsertDep | undefined;
      if (dep) {
        onDepReady(dep.commit.bind(dep));
      }
    });
    return null;
  }

  it('insert dep commit creates a rect node with correct bounds in the scene', () => {
    const scene = makeEmptyScene();
    let capturedCommit: InsertDep['commit'] | null = null;

    render(
      <SceneCanvas<D14, L14, P14> features={['draw']}
        scene={scene}
        width={200}
        height={200}
      >
        <DepHarness onDepReady={(commit) => { capturedCommit = commit; }} />
      </SceneCanvas>,
    );

    // Verify the dep was registered.
    expect(capturedCommit).not.toBeNull();

    // Call commit directly to simulate what insertAction.invoker.onEnd does.
    act(() => {
      capturedCommit!({ x: 10, y: 20, width: 100, height: 50 }, { kind: 'rect' });
    });

    const nodes = [...scene.nodes.values()];
    expect(nodes).toHaveLength(1);
    const node = nodes[0];
    const pose = node.pose as P14;
    expect(pose.x).toBe(10);
    expect(pose.y).toBe(20);
    expect(pose.width).toBe(100);
    expect(pose.height).toBe(50);
    expect(node.kind).toBe('mark');
    const data = node.data as D14;
    expect(data.fill).toBeTruthy();
    expect(data.path).toBeTruthy();
  });

  it('insert dep commit creates an ellipse node', () => {
    const scene = makeEmptyScene();
    let capturedCommit: InsertDep['commit'] | null = null;

    render(
      <SceneCanvas<D14, L14, P14> features={['draw']}
        scene={scene}
        width={200}
        height={200}
      >
        <DepHarness onDepReady={(commit) => { capturedCommit = commit; }} />
      </SceneCanvas>,
    );

    expect(capturedCommit).not.toBeNull();

    act(() => {
      capturedCommit!({ x: 5, y: 15, width: 80, height: 40 }, { kind: 'ellipse' });
    });

    const nodes = [...scene.nodes.values()];
    expect(nodes).toHaveLength(1);
    const node = nodes[0];
    const pose = node.pose as P14;
    expect(pose.x).toBe(5);
    expect(pose.y).toBe(15);
    expect(pose.width).toBe(80);
    expect(pose.height).toBe(40);
    expect(node.kind).toBe('mark');
    const data = node.data as D14;
    expect(data.fill).toBeTruthy();
    expect(data.path).toBeTruthy();
  });

  it('insert dep commit returns null and warns for unknown kind', () => {
    const scene = makeEmptyScene();
    let capturedCommit: InsertDep['commit'] | null = null;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <SceneCanvas<D14, L14, P14> features={['draw']}
        scene={scene}
        width={200}
        height={200}
      >
        <DepHarness onDepReady={(commit) => { capturedCommit = commit; }} />
      </SceneCanvas>,
    );

    expect(capturedCommit).not.toBeNull();

    let result: string | null = 'sentinel';
    act(() => {
      result = capturedCommit!({ x: 0, y: 0, width: 10, height: 10 }, { kind: 'unknown-kind' });
    });

    expect(result).toBeNull();
    expect([...scene.nodes.values()]).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unknown-kind'));
    warnSpy.mockRestore();
  });
});
