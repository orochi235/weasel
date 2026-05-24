import { describe, it, expect, vi } from 'vitest';
import { dispatchDoubleClickEntry } from './doubleClickEntry';

describe('dispatchDoubleClickEntry', () => {
  it('hit.kind="path" enters path-edit with hit.id', () => {
    const machine = { enterMode: vi.fn() };
    dispatchDoubleClickEntry({ kind: 'path', id: 'p1' }, machine as never);
    expect(machine.enterMode).toHaveBeenCalledWith('path-edit', { targetId: 'p1' });
  });

  it('hit.kind="group" enters isolation', () => {
    const machine = { enterMode: vi.fn() };
    dispatchDoubleClickEntry({ kind: 'group', id: 'g1' }, machine as never);
    expect(machine.enterMode).toHaveBeenCalledWith('isolation', { targetId: 'g1' });
  });

  it('hit.kind="text" enters text-edit', () => {
    const machine = { enterMode: vi.fn() };
    dispatchDoubleClickEntry({ kind: 'text', id: 't1' }, machine as never);
    expect(machine.enterMode).toHaveBeenCalledWith('text-edit', { targetId: 't1' });
  });

  it('unknown kind is a no-op', () => {
    const machine = { enterMode: vi.fn() };
    dispatchDoubleClickEntry({ kind: 'shape', id: 's1' } as never, machine as never);
    expect(machine.enterMode).not.toHaveBeenCalled();
  });

  it('null hit is a no-op', () => {
    const machine = { enterMode: vi.fn() };
    dispatchDoubleClickEntry(null, machine as never);
    expect(machine.enterMode).not.toHaveBeenCalled();
  });
});
