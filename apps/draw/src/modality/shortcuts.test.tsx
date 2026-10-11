/**
 * The mode machine's keys ride the canvas's dispatcher: each mode's declared
 * shortcuts, gated on that mode being active.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { ActionsProvider, DepRegistryProvider, SceneCanvas, asNodeId, createScene, pathFromD, useActionsRegistry, useDepRegistry, type DepRegistry, type PolygonPath } from '@weasel-js/core';
import { useMemo } from 'react';
import { DEFAULT_MODES } from '@weasel-js/modes';
import { createModeMachine } from './machine';
import { modalityShortcuts } from './shortcuts';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});
afterEach(() => cleanup());

function fakeHistory() {
  return {
    beginJournal: vi.fn(() => ({
      applyBatch: vi.fn(),
      commit: vi.fn(),
      cancel: vi.fn(),
      suspend: vi.fn(),
    })),
    resumeJournal: vi.fn(),
    entries: () => ({ undo: [], redo: [] }),
  };
}

const ID = asNodeId('a');

function setup() {
  const machine = createModeMachine({ modes: DEFAULT_MODES, history: fakeHistory() as never });
  const scene = createScene<{ kind: 'rect' }, 'main', { x: number; y: number; width: number; height: number }>(
    { systemLayers: [{ id: 'main' }] },
  );
  scene.add({ id: ID, kind: 'leaf', data: { kind: 'rect' }, layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 } });
  scene.setSelection([ID]);
  render(
    <SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64}
      ambient={[modalityShortcuts(machine)]}
      modes={machine.registry} />,
  );
  const key = (key: string, init: KeyboardEventInit = {}) => act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  });
  return { machine, scene, key };
}

describe('modality shortcuts', () => {
  it('Escape leaves a soft mode, keeping the selection', () => {
    const t = setup();
    act(() => t.machine.enterMode('path-edit', { targetId: 'a' }));
    const exit = vi.spyOn(t.machine, 'exitMode');
    t.key('Escape');
    expect(exit).toHaveBeenCalledOnce();
    expect(t.machine.registry.current().id).toBe('normal');
    expect(t.scene.getSelection()).toEqual([ID]);
  });

  it('Meta+Escape discards a soft mode', () => {
    const t = setup();
    act(() => t.machine.enterMode('isolation', { targetId: 'a' }));
    const discard = vi.spyOn(t.machine, 'discardMode');
    t.key('Escape', { metaKey: true });
    expect(discard).toHaveBeenCalledOnce();
    expect(t.machine.registry.current().id).toBe('normal');
  });

  it('Enter commits and Escape cancels a strict mode', () => {
    const t = setup();
    act(() => t.machine.enterMode('crop', {}));
    const commit = vi.spyOn(t.machine, 'commitMode');
    t.key('Enter');
    expect(commit).toHaveBeenCalledOnce();
    act(() => t.machine.enterMode('free-transform', {}));
    const cancel = vi.spyOn(t.machine, 'cancelMode');
    t.key('Escape');
    expect(cancel).toHaveBeenCalledOnce();
    expect(t.machine.registry.current().id).toBe('normal');
  });

  it('leaves Escape to the canvas in normal mode', () => {
    const t = setup();
    const exit = vi.spyOn(t.machine, 'exitMode');
    t.key('Escape');
    expect(exit).not.toHaveBeenCalled();
    expect(t.scene.getSelection()).toEqual([]);
  });
});

describe('entering path-edit from the keyboard', () => {
  function Harness({ machine, scene, pathToEdit }: {
    machine: ReturnType<typeof createModeMachine>;
    scene: ReturnType<typeof createScene<{ path: PolygonPath }, 'main', { x: number; y: number; width: number; height: number }>>;
    pathToEdit: () => string | null;
  }) {
    const actions = useActionsRegistry();
    const deps = useDepRegistry();
    depsRef.current = deps;
    const keys = useMemo(() => modalityShortcuts(machine, {
      pathToEdit,
      startPathEdit: () => { actions?.trigger('enterPathEdit'); },
    }), [machine, pathToEdit, actions]);
    return (
      <SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64}
        ambient={[keys]} modes={machine.registry} />
    );
  }
  const depsRef: { current: DepRegistry | null } = { current: null };

  function setupPath(pathToEdit: () => string | null) {
    const machine = createModeMachine({ modes: DEFAULT_MODES, history: fakeHistory() as never });
    const scene = createScene<{ path: PolygonPath }, 'main', { x: number; y: number; width: number; height: number }>(
      { systemLayers: [{ id: 'main' }] },
    );
    scene.add({ id: ID, kind: 'leaf', data: { path: pathFromD('M 0 0 L 10 0 L 10 10') as PolygonPath }, layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 } });
    scene.setSelection([ID]);
    render(
      <DepRegistryProvider>
        <ActionsProvider>
          <Harness machine={machine} scene={scene} pathToEdit={pathToEdit} />
        </ActionsProvider>
      </DepRegistryProvider>,
    );
    const key = (k: string) => act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    });
    const editingId = () => (depsRef.current!.get as (k: string) => { editingId: string } | undefined)('editAnchors')?.editingId;
    return { machine, key, editingId };
  }

  it('Enter on a selected path enters path-edit on it, with its anchors editable', () => {
    const t = setupPath(() => ID);
    t.key('Enter');
    expect(t.machine.registry.current().id).toBe('path-edit');
    expect(t.machine.getActiveTargetId()).toBe(ID);
    expect(t.editingId()).toBe(ID);
  });

  it('Enter does nothing to the mode when the selection offers no path', () => {
    const t = setupPath(() => null);
    t.key('Enter');
    expect(t.machine.registry.current().id).toBe('normal');
  });
});
