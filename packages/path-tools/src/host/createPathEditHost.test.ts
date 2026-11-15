import { describe, expect, it, vi } from 'vitest';
import { createEmitter } from '@weasel-js/registry';
import { createPathEditHost, type PathEditModes } from './createPathEditHost';

/** A mode registry reduced to what the host drives. */
function createModeRegistry({ initial }: { initial: string }): PathEditModes {
  let id = initial;
  const changed = createEmitter();
  return {
    current: () => ({ id }),
    setMode(next) { if (next !== id) { id = next; changed.emit(); } },
    subscribe: changed.subscribe,
  };
}

describe('createPathEditHost', () => {
  it('starts on the path and anchors it is given, and tells subscribers of each change', () => {
    const host = createPathEditHost({ id: 'a', anchors: [0, 2] });
    const heard = vi.fn();
    host.subscribe(heard);
    expect(host.editingId()).toBe('a');
    expect([...host.selectedAnchors()]).toEqual([0, 2]);
    host.setSelectedAnchors(new Set([1]));
    host.setEditingId(null);
    expect(host.editingId()).toBeNull();
    expect([...host.selectedAnchors()]).toEqual([1]);
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('as a mode: opening a path enters path edit, and closing it leaves for the exit mode', () => {
    const modes = createModeRegistry({ initial: 'normal' });
    const host = createPathEditHost({ modes });
    const heard = vi.fn();
    host.subscribe(heard);
    host.setEditingId('a');
    expect(modes.current().id).toBe('path-edit');
    expect(host.editingId()).toBe('a');
    host.setEditingId(null);
    expect(modes.current().id).toBe('normal');
    // Once per change: the mode's switch says it, not the host again.
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it('as a mode: a path counts as open only while the mode is, and comes back with it', () => {
    const modes = createModeRegistry({ initial: 'path-edit' });
    const host = createPathEditHost({ id: 'a', modes });
    const heard = vi.fn();
    host.subscribe(heard);
    modes.setMode('crop');
    expect(host.editingId()).toBeNull();
    expect(heard).toHaveBeenCalledTimes(1);
    host.setEditingId(null);
    expect(modes.current().id).toBe('crop');
    host.setEditingId('b');
    expect(modes.current().id).toBe('path-edit');
    expect(host.editingId()).toBe('b');
  });

  it('names the open path from a mode target, and opens and closes through it', () => {
    const modes = createModeRegistry({ initial: 'normal' });
    let on: string | null = null;
    const target = {
      get: () => on,
      open: vi.fn((id: string) => { on = id; modes.setMode('path-edit'); }),
      close: vi.fn(() => { on = null; modes.setMode('normal'); }),
    };
    const setMode = vi.spyOn(modes, 'setMode');
    const host = createPathEditHost({ modes, target });
    host.setEditingId('a');
    expect(target.open).toHaveBeenCalledWith('a');
    expect(host.editingId()).toBe('a');
    host.setEditingId(null);
    expect(target.close).toHaveBeenCalledTimes(1);
    host.setEditingId(null);
    expect(target.close).toHaveBeenCalledTimes(1);
    // Only the target moved the registry.
    expect(setMode).toHaveBeenCalledTimes(2);
  });

  it('names no path while the open one fails `editable`', () => {
    const host = createPathEditHost({ id: 'rect', editable: (id) => id !== 'rect' });
    expect(host.editingId()).toBeNull();
    host.setEditingId('curve');
    expect(host.editingId()).toBe('curve');
  });
});
