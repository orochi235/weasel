/**
 * Path-edit end-to-end integration test.
 *
 * Exercises the full wiring stack:
 *   dispatchDoubleClickEntry → ModeMachine.enterMode → registry change
 *   → ModeBreadcrumb shows "Path Edit"
 *   → keydown Escape → machine.exitMode() → breadcrumb gone
 *
 * jsdom limitation: <SceneCanvas> never mounts in jsdom (canvas element has
 * zero dimensions, so the hostDims gate in App prevents it from rendering).
 * This means we cannot simulate a real dblclick on a canvas hit area or
 * exercise the ToolPalette aria-disabled greying wired in <App> (which also
 * requires a live ToolsApi provided by SceneCanvas's onToolsCreated).
 * We therefore test at the layer below the canvas: we build a real
 * ModeMachine, call dispatchDoubleClickEntry with a fake path hit, and
 * render a ModeBreadcrumb that subscribes to the machine. This is still a
 * genuine integration test — it exercises every real module in the
 * enter-mode → chrome-update → exit-mode flow except the canvas hit resolver.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { useState, useEffect, type ReactElement } from 'react';

import { createModeMachine } from './machine';
import { dispatchDoubleClickEntry } from './doubleClickEntry';
import { ModeBreadcrumb } from './chrome/ModeBreadcrumb';
import { DEFAULT_MODES } from '@orochi235/weasel-modes';

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

/**
 * Renders a ModeBreadcrumb that tracks a live ModeMachine via its registry
 * subscription. Also wires the same keydown handler that App.tsx registers
 * (capture-phase on window), so fireEvent.keyDown exercises real exit logic.
 */
function MachineHarness({
  machine,
}: {
  machine: ReturnType<typeof createModeMachine>;
}): ReactElement {
  const [modeId, setModeId] = useState(machine.registry.current().id);

  // Subscribe to registry changes — same pattern as App's useModeId helper.
  useEffect(() => {
    return machine.registry.subscribe(() => setModeId(machine.registry.current().id));
  }, [machine]);

  // Wire the same capture-phase keydown handler App.tsx uses.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const mode = machine.registry.current();
      if (mode.id === 'normal') return;
      if (e.key === 'Escape') {
        if (e.metaKey && mode.kind === 'soft') { machine.discardMode(); return; }
        if (mode.kind === 'soft') machine.exitMode();
        else machine.cancelMode();
      }
      if (e.key === 'Enter' && mode.kind === 'strict') machine.commitMode();
    }
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [machine]);

  return (
    <ModeBreadcrumb
      modeId={modeId}
      modeKind={machine.registry.current().kind}
      targetLabel={null}
      onExit={() => machine.exitMode()}
      onCommit={() => machine.commitMode()}
      onCancel={() => machine.cancelMode()}
    />
  );
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

    // Simulate double-click on a path node — the same call App's onDoubleClick
    // callback makes when SceneCanvas delivers a hit with kind='path'.
    act(() => {
      dispatchDoubleClickEntry({ kind: 'path', id: 'path-1' }, machine);
    });

    // Breadcrumb must now show "Path Edit".
    expect(screen.getByText(/path edit/i)).toBeTruthy();

    // The mode machine is in path-edit; the registry current id confirms it.
    expect(machine.registry.current().id).toBe('path-edit');

    // The active journal was opened (path-edit is a soft mode with a journal).
    expect(machine.getActiveJournal()).not.toBeNull();

    // Fire Escape through window — the capture-phase handler should call
    // machine.exitMode() (soft mode, no metaKey).
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });

    // Mode returns to normal; breadcrumb disappears.
    expect(machine.registry.current().id).toBe('normal');
    expect(screen.queryByText(/path edit/i)).toBeNull();

    // The journal was suspended (soft-mode exit suspends for potential resume).
    expect(machine.getActiveJournal()).toBeNull();
  });

  it('re-entering path-edit on the same target resumes the cached journal', () => {
    const history = fakeHistory();
    const machine = createModeMachine({
      modes: DEFAULT_MODES,
      history: history as never,
    });

    render(<MachineHarness machine={machine} />);

    // Enter, then exit (suspend).
    act(() => { dispatchDoubleClickEntry({ kind: 'path', id: 'path-1' }, machine); });
    expect(machine.registry.current().id).toBe('path-edit');
    act(() => { machine.exitMode(); });
    expect(history.beginJournal).toHaveBeenCalledTimes(1);

    // Re-enter the same target — journal cache should resume, not begin fresh.
    act(() => { dispatchDoubleClickEntry({ kind: 'path', id: 'path-1' }, machine); });
    expect(machine.registry.current().id).toBe('path-edit');
    // beginJournal still at 1 — the cached journal was resumed.
    expect(history.beginJournal).toHaveBeenCalledTimes(1);
    expect(history.resumeJournal).toHaveBeenCalledTimes(1);
  });
});
