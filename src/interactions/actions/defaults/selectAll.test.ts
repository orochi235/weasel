import { describe, it, expect, vi } from 'vitest';
import { defaultSelectAllAction } from './selectAll';
import { asNodeId } from '../../../core/scene/types';

describe('defaultSelectAllAction', () => {
  const baseDeps = {
    getSelection: () => [],
    listAll: () => [asNodeId('a'), asNodeId('b'), asNodeId('c')],
    setSelection: vi.fn(),
  };

  it('returns Action with id="selectAll"', () => {
    const a = defaultSelectAllAction(baseDeps);
    expect(a.id).toBe('selectAll');
  });

  it('returns Action with label "Select All"', () => {
    expect(defaultSelectAllAction(baseDeps).label).toBe('Select All');
  });

  it('default binding is Cmd/Ctrl+A', () => {
    expect(defaultSelectAllAction(baseDeps).defaultBinding).toEqual({ key: 'a', mod: true });
  });

  it('run() dispatches setSelection with all ids when listAll non-empty', () => {
    const setSelection = vi.fn();
    const a = defaultSelectAllAction({
      getSelection: () => [],
      listAll: () => [asNodeId('a'), asNodeId('b')],
      setSelection,
    });
    a.run();
    expect(setSelection).toHaveBeenCalledWith(['a', 'b']);
  });

  it('run() is a no-op when listAll() is empty', () => {
    const setSelection = vi.fn();
    const a = defaultSelectAllAction({
      getSelection: () => [],
      listAll: () => [],
      setSelection,
    });
    a.run();
    expect(setSelection).not.toHaveBeenCalled();
  });
});
