/**
 * Tests for the modality keyboard handler logic wired in App.tsx.
 *
 * The handler:
 *   - In 'normal' mode: does nothing (lets kit's useKeybindings handle Escape).
 *   - In a soft mode: Escape → exitMode; Meta+Escape → discardMode.
 *   - In a strict mode: Escape → cancelMode; Enter → commitMode.
 */
import { describe, it, expect, vi } from 'vitest';
import { createModeMachine } from './machine';
import { DEFAULT_MODES } from '@weasel-js/modes';

function fakeHistory() {
  return {
    beginJournal: vi.fn(() => ({
      committed: false,
      cancelled: false,
      suspended: false,
      applyBatch: vi.fn(),
      commit(_label: string) { (this as { committed: boolean }).committed = true; },
      cancel() { (this as { cancelled: boolean }).cancelled = true; },
      suspend() { (this as { suspended: boolean }).suspended = true; },
      entries: () => ({ undo: [], redo: [] }),
      canUndo: () => false,
      canRedo: () => false,
      undo: vi.fn(),
      redo: vi.fn(),
    })),
    resumeJournal: vi.fn(),
  };
}

/** Simulate what App.tsx's keydown handler does. */
function makeKeyHandler(machine: ReturnType<typeof createModeMachine>) {
  return function onKey(e: { key: string; metaKey?: boolean; preventDefault?: () => void; stopPropagation?: () => void }): void {
    const mode = machine.registry.current();
    if (mode.id === 'normal') return;

    if (e.key === 'Escape') {
      if (e.metaKey && mode.kind === 'soft') {
        machine.discardMode();
        return;
      }
      if (mode.kind === 'soft') machine.exitMode();
      else machine.cancelMode();
      return;
    }
    if (e.key === 'Enter' && mode.kind === 'strict') {
      machine.commitMode();
    }
  };
}

describe('modality keyboard handler', () => {
  it('Escape in normal mode does not call any machine method', () => {
    const history = fakeHistory();
    const machine = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    const exitSpy = vi.spyOn(machine, 'exitMode');
    const cancelSpy = vi.spyOn(machine, 'cancelMode');

    const onKey = makeKeyHandler(machine);
    onKey({ key: 'Escape' });

    expect(exitSpy).not.toHaveBeenCalled();
    expect(cancelSpy).not.toHaveBeenCalled();
    expect(machine.registry.current().id).toBe('normal');
  });

  it('Escape in path-edit (soft) calls exitMode and returns to normal', () => {
    const history = fakeHistory();
    const machine = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    machine.enterMode('path-edit', { targetId: 'p1' });
    expect(machine.registry.current().id).toBe('path-edit');

    const exitSpy = vi.spyOn(machine, 'exitMode');
    const onKey = makeKeyHandler(machine);
    onKey({ key: 'Escape' });

    expect(exitSpy).toHaveBeenCalledOnce();
    expect(machine.registry.current().id).toBe('normal');
  });

  it('Meta+Escape in path-edit (soft) calls discardMode', () => {
    const history = fakeHistory();
    const machine = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
    machine.enterMode('path-edit', { targetId: 'p1' });

    const discardSpy = vi.spyOn(machine, 'discardMode');
    const onKey = makeKeyHandler(machine);
    onKey({ key: 'Escape', metaKey: true });

    expect(discardSpy).toHaveBeenCalledOnce();
    expect(machine.registry.current().id).toBe('normal');
  });
});
