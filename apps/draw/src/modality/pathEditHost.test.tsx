/**
 * Which path is being anchor-edited is the machine's path-edit target, and
 * nothing else: the canvas reads it from there and asks the machine to change
 * it.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import {
  ActionsProvider, DepRegistryProvider, SceneCanvas, asNodeId, createScene, hasEditablePath, pathFromD,
  rectPath, useActionsRegistry, useDepRegistry, type Path, type PolygonPath,
} from '@weasel-js/core';
import { useMemo } from 'react';
import { DEFAULT_MODES } from '@weasel-js/modes';
import { createModeMachine } from './machine';
import { createAnchorSelection } from './anchorSelection';
import { modePathEdit } from './pathEditHost';

beforeAll(() => {
  (HTMLCanvasElement.prototype as unknown as { getContext: () => null }).getContext = () => null;
});
afterEach(() => cleanup());

function fakeHistory() {
  return {
    beginJournal: vi.fn(() => ({ applyBatch: vi.fn(), commit: vi.fn(), cancel: vi.fn(), suspend: vi.fn() })),
    resumeJournal: vi.fn(),
    entries: () => ({ undo: [], redo: [] }),
  };
}

const A = asNodeId('a');
const B = asNodeId('b');
type EditAnchors = {
  editingId: string;
  setEditingId(id: string | null): void;
  getEditablePath(id: string): PolygonPath | null;
  applyEdit(id: string, worldPath: PolygonPath, label: string): void;
};

function setup(pathOfA: Path = pathFromD('M 0 0 L 10 0 L 10 10') as PolygonPath) {
  const machine = createModeMachine({ modes: DEFAULT_MODES, history: fakeHistory() as never });
  const scene = createScene<{ path: Path }, 'main', { x: number; y: number; width: number; height: number }>(
    { systemLayers: [{ id: 'main' }] },
  );
  for (const id of [A, B]) {
    const path = id === A ? pathOfA : pathFromD('M 0 0 L 10 0 L 10 10');
    scene.add({ id, kind: 'mark', data: { path }, layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 } });
  }
  scene.setSelection([A]);
  const grabbed: { trigger?: (id: string) => void; editAnchors?: () => EditAnchors } = {};
  function Harness() {
    const actions = useActionsRegistry();
    const deps = useDepRegistry();
    grabbed.trigger = (id) => { actions?.trigger(id); };
    grabbed.editAnchors = () => (deps.get as (k: string) => EditAnchors)('editAnchors');
    const pathEdit = useMemo(() => modePathEdit(machine, (id) => hasEditablePath(scene.get(asNodeId(id)))), []);
    return (
      <SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64}
        modes={machine.registry} pathEdit={pathEdit} />
    );
  }
  render(<DepRegistryProvider><ActionsProvider><Harness /></ActionsProvider></DepRegistryProvider>);
  return {
    machine, scene,
    trigger: (id: string) => act(() => grabbed.trigger!(id)),
    editAnchors: () => grabbed.editAnchors!(),
  };
}

describe('path editing owned by the mode machine', () => {
  it('enters path-edit when the canvas opens a path, as its double-click binding does', () => {
    const t = setup();
    t.trigger('enterPathEdit');
    expect(t.machine.registry.current().id).toBe('path-edit');
    expect(t.machine.getActiveTargetId()).toBe(A);
    expect(t.editAnchors().editingId).toBe(A);
  });

  it('leaves path-edit when the canvas closes the path', () => {
    const t = setup();
    t.trigger('enterPathEdit');
    act(() => t.editAnchors().setEditingId(null));
    expect(t.machine.registry.current().id).toBe('normal');
    expect(t.editAnchors().editingId).toBe('');
  });

  it('edits the path the mode is on, with nothing left over from the last one', () => {
    const t = setup();
    t.trigger('enterPathEdit');
    act(() => t.machine.exitMode());
    expect(t.editAnchors().editingId).toBe('');
    act(() => {
      t.scene.setSelection([B]);
      t.machine.enterMode('path-edit', { targetId: B });
    });
    expect(t.editAnchors().editingId).toBe(B);
  });

  it('edits a drawn rectangle by its corners, and stores a polygon from the first edit', () => {
    const t = setup(rectPath(0, 0, 10, 10));
    t.trigger('enterPathEdit');
    expect(t.editAnchors().editingId).toBe(A);
    const corners = t.editAnchors().getEditablePath(A)!;
    expect(Array.from(corners.coords)).toEqual([0, 0, 10, 0, 10, 10, 0, 10]);
    expect(t.scene.get(A)!.data.path.kind).toBe('rect');

    const moved = Float32Array.from(corners.coords);
    moved[4] = 20;
    act(() => t.editAnchors().applyEdit(A, { ...corners, coords: moved }, 'Move anchor'));
    const node = t.scene.get(A)!;
    expect(node.data.path.kind).toBe('polygon');
    expect(node.pose).toMatchObject({ x: 0, y: 0, width: 20, height: 10 });
    expect(Array.from(t.editAnchors().getEditablePath(A)!.coords)).toEqual([0, 0, 10, 0, 20, 10, 0, 10]);
  });
});

describe('modePathEdit', () => {
  const machine = () => createModeMachine({ modes: DEFAULT_MODES, history: fakeHistory() as never });

  it('names no path while the mode is on a node with no anchors to edit', () => {
    const m = machine();
    const host = modePathEdit(m, (id) => id !== 'rect');
    m.enterMode('path-edit', { targetId: 'rect' });
    expect(host.editingId()).toBeNull();
  });

  it('names no path in another mode, and closing one there leaves that mode alone', () => {
    const m = machine();
    const host = modePathEdit(m, () => true);
    m.enterMode('text-edit', { targetId: 't' });
    expect(host.editingId()).toBeNull();
    host.setEditingId(null);
    expect(m.registry.current().id).toBe('text-edit');
  });

  it('opening the path already open changes nothing', () => {
    const history = fakeHistory();
    const m = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    const host = modePathEdit(m, () => true);
    host.setEditingId('a');
    host.setEditingId('a');
    expect(history.beginJournal).toHaveBeenCalledTimes(1);
    expect(host.editingId()).toBe('a');
  });

  it('owns the anchor selection when handed one, for the corner controls to read', () => {
    const anchors = createAnchorSelection();
    const host = modePathEdit(machine(), () => true, anchors);
    host.setSelectedAnchors!(new Set([2]));
    expect([...anchors.get()]).toEqual([2]);
    expect(host.selectedAnchors!()).toBe(anchors.get());
  });
});
