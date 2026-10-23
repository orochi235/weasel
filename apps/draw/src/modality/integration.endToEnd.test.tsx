/**
 * Path-edit flow: double-click a path → the canvas's `enterPathEdit` binding →
 * ModeMachine.enterMode → ModeBreadcrumb shows "Path Edit" → Escape →
 * machine.exitMode() → breadcrumb gone.
 *
 * App's <SceneCanvas> never mounts in jsdom (the canvas has zero dimensions, so
 * the hostDims gate holds it back), so this mounts a bare canvas wired to a real
 * ModeMachine the way Workspace wires it, through `useCanvasModes`.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { screen, act, fireEvent } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useState, useEffect, type ReactElement } from 'react';

import { createModeMachine } from './machine';
import { ModeBreadcrumb } from './chrome/ModeBreadcrumb';
import { modePathEdit } from './pathEditHost';
import { useCanvasModes } from './useCanvasModes';
import { DEFAULT_MODES } from '@weasel-js/modes';
import { SceneCanvas, asNodeId, createScene, hasEditablePath, pathFromD, solid, useSelection, type PolygonPath } from '@weasel-js/core';
import type { DrawScene } from '../drawDocument';

beforeAll(() => {
  (HTMLCanvasElement.prototype as unknown as { getContext: () => null }).getContext = () => null;
});

// ─── Minimal history stub (no real scene needed) ─────────────────────────────

function fakeHistory() {
  return {
    beginJournal: vi.fn(() => ({
      applyBatch: vi.fn(),
      commit(_label: string) {},
      cancel() {},
      suspend() {},
      entries: () => ({ undo: [], redo: [] }),
      canUndo: () => false,
      canRedo: () => false,
      undo: vi.fn(),
      redo: vi.fn(),
    })),
    resumeJournal: vi.fn(),
    entries: () => ({ undo: [], redo: [] }),
  };
}

// ─── Reactive harness ─────────────────────────────────────────────────────────

/** The canvas carries the same mode shortcuts Workspace.tsx installs, so a window
 *  keydown exercises the real exit route. */
function MachineHarness({
  machine,
}: {
  machine: ReturnType<typeof createModeMachine>;
}): ReactElement {
  const [modeId, setModeId] = useState(machine.registry.current().id);
  const [scene] = useState(() => {
    const s = createScene({ systemLayers: [{ id: 'main' }] });
    s.add({
      id: asNodeId('path-1'), kind: 'mark', layer: 'main',
      data: { path: pathFromD('M 0 0 L 40 0 L 40 40 L 0 40 Z') as PolygonPath, fill: { paint: solid('#888') } },
      pose: { x: 0, y: 0, width: 40, height: 40 },
    });
    return s as unknown as DrawScene;
  });
  const selection = useSelection({ mode: 'multi', scene });
  const [pathEdit] = useState(() => modePathEdit(machine, (id) => hasEditablePath(scene.get(asNodeId(id)))));
  const modes = useCanvasModes(machine, scene, selection, pathEdit);

  // Subscribe to registry changes — same pattern as App's useModeId helper.
  useEffect(() => {
    return machine.registry.subscribe(() => setModeId(machine.registry.current().id));
  }, [machine]);

  return (
    <>
      <ModeBreadcrumb
        mode={machine.registry.byId(modeId)}
        targetLabel={null}
        onExit={() => machine.exitMode()}
        onCommit={() => machine.commitMode()}
        onCancel={() => machine.cancelMode()}
      />
      <SceneCanvas features={['draw']} scene={scene} selection={selection} layers={{}} width={64} height={64}
        ambient={modes.ambient}
        modes={machine.registry}
        pathEdit={modes.pathEdit} />
    </>
  );
}

function doubleClickPath(): void {
  const canvas = document.querySelector('canvas')!;
  const press = (type: string) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: 20, clientY: 20, pointerId: 1 }));
  act(() => { press('pointerdown'); press('pointerup'); press('pointerdown'); press('pointerup'); });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('path-edit end-to-end integration', () => {
  it('double-click on a path enters path-edit; breadcrumb visible; Escape suspends and hides breadcrumb', async () => {
    const machine = createModeMachine({
      modes: DEFAULT_MODES,
      history: fakeHistory() as never,
    });

    render(<MachineHarness machine={machine} />);

    // Breadcrumb is absent in normal mode.
    expect(screen.queryByText(/path edit/i)).toBeNull();

    doubleClickPath();

    // Breadcrumb must now show "Path Edit".
    expect(screen.getByText(/path edit/i)).toBeTruthy();

    // The mode machine is in path-edit; the registry current id confirms it.
    expect(machine.registry.current().id).toBe('path-edit');
    expect(machine.getActiveTargetId()).toBe('path-1');

    // The active journal was opened (path-edit is a soft mode with a journal).
    expect(machine.getActiveJournal()).not.toBeNull();

    // Escape through window reaches the canvas's path-edit exit binding.
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    // Mode returns to normal; breadcrumb disappears.
    expect(machine.registry.current().id).toBe('normal');
    expect(screen.queryByText(/path edit/i)).toBeNull();

    // Leaving closed the journal, its edits landing on the history as one step.
    expect(machine.getActiveJournal()).toBeNull();
  });

  it('re-entering path-edit on the same target opens a fresh journal', () => {
    const history = fakeHistory();
    const machine = createModeMachine({
      modes: DEFAULT_MODES,
      history: history as never,
    });

    render(<MachineHarness machine={machine} />);

    doubleClickPath();
    act(() => { machine.exitMode(); });
    doubleClickPath();
    expect(machine.registry.current().id).toBe('path-edit');
    expect(history.beginJournal).toHaveBeenCalledTimes(2);
  });
});
