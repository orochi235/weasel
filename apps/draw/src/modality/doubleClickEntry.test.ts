import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_MODES } from '@weasel-js/modes';
import { dispatchDoubleClickEntry } from './doubleClickEntry';
import { createModeMachine } from './machine';

function fakeHistory() {
  return {
    beginJournal: vi.fn(() => ({ applyBatch: vi.fn(), commit: vi.fn(), cancel: vi.fn(), suspend: vi.fn() })),
    resumeJournal: vi.fn(),
    entries: () => ({ undo: [], redo: [] }),
  };
}
const realMachine = () => createModeMachine({ modes: DEFAULT_MODES, history: fakeHistory() as never });
const idle = (enterMode = vi.fn()) => ({
  enterMode, getActiveTargetId: () => null, registry: { current: () => ({ id: 'normal', kind: 'soft' }) },
});

describe('dispatchDoubleClickEntry', () => {
  it('hit.kind="path" enters path-edit with hit.id', () => {
    const machine = idle();
    dispatchDoubleClickEntry({ kind: 'path', id: 'p1' }, machine as never);
    expect(machine.enterMode).toHaveBeenCalledWith('path-edit', { targetId: 'p1' });
  });

  it('hit.kind="group" enters isolation', () => {
    const machine = idle();
    dispatchDoubleClickEntry({ kind: 'group', id: 'g1' }, machine as never);
    expect(machine.enterMode).toHaveBeenCalledWith('isolation', { targetId: 'g1' });
  });

  it('hit.kind="text" enters nothing: the edit opening is what enters text-edit', () => {
    const machine = idle();
    dispatchDoubleClickEntry({ kind: 'text', id: 't1' }, machine as never);
    expect(machine.enterMode).not.toHaveBeenCalled();
  });

  it('unknown kind is a no-op', () => {
    const machine = idle();
    dispatchDoubleClickEntry({ kind: 'shape', id: 's1' } as never, machine as never);
    expect(machine.enterMode).not.toHaveBeenCalled();
  });

  it('null hit is a no-op', () => {
    const machine = idle();
    dispatchDoubleClickEntry(null, machine as never);
    expect(machine.enterMode).not.toHaveBeenCalled();
  });

  it('a second double-click on the path being edited stays in path-edit', () => {
    const machine = realMachine();
    machine.enterMode('path-edit', { targetId: 'a' });
    expect(() => dispatchDoubleClickEntry({ kind: 'path', id: 'a' }, machine)).not.toThrow();
    expect(machine.registry.current().id).toBe('path-edit');
    expect(machine.getActiveTargetId()).toBe('a');
  });

  it('a double-click on a path inside an isolated group leaves isolation for path-edit', () => {
    const machine = realMachine();
    machine.enterMode('isolation', { targetId: 'g' });
    expect(() => dispatchDoubleClickEntry({ kind: 'path', id: 'a' }, machine)).not.toThrow();
    expect(machine.registry.current().id).toBe('path-edit');
    expect(machine.getActiveTargetId()).toBe('a');
  });

  it('a double-click during a strict mode leaves it alone', () => {
    const machine = realMachine();
    machine.enterMode('crop', {});
    expect(() => dispatchDoubleClickEntry({ kind: 'path', id: 'a' }, machine)).not.toThrow();
    expect(machine.registry.current().id).toBe('crop');
  });
});
