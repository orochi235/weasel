import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDelete } from './delete';
import type { DeleteAdapter } from './delete';
import type { Op } from '../../..';
import { type NodeId } from 'core/scene/types';

function makeAdapter(initial: string[] = []) {
  let selection = [...initial] as NodeId[];
  const batches: { ops: Op[]; label: string }[] = [];
  const adapter: DeleteAdapter = {
    getSelection: () => selection,
    getNode: (id) => ({ id }),
    getNodeIndex: (id) => selection.indexOf(id),
    setSelection: (ids) => { selection = [...ids]; },
    applyOps: (ops, label) => { batches.push({ ops, label }); },
  };
  return {
    adapter,
    batches,
    setSel: (ids: string[]) => { selection = [...ids] as NodeId[]; },
    getSel: () => selection,
  };
}

describe('useDelete', () => {
  it('emits N delete ops + 1 setSelection op and uses default label', () => {
    const helpers = makeAdapter(['a', 'b']);
    const { result } = renderHook(() => useDelete(helpers.adapter));
    let returned: string[] = [];
    act(() => { returned = result.current.deleteSelection(); });
    expect(returned).toEqual(['a', 'b']);
    expect(helpers.batches).toHaveLength(1);
    expect(helpers.batches[0].label).toBe('Delete');
    expect(helpers.batches[0].ops).toHaveLength(3);
  });

  it('returns deleted ids', () => {
    const helpers = makeAdapter(['x', 'y', 'z']);
    const { result } = renderHook(() => useDelete(helpers.adapter));
    let returned: string[] = [];
    act(() => { returned = result.current.deleteSelection(); });
    expect(returned).toEqual(['x', 'y', 'z']);
  });

  it('empty selection: no applyOps, returns []', () => {
    const helpers = makeAdapter([]);
    const { result } = renderHook(() => useDelete(helpers.adapter));
    let returned: string[] = ['sentinel'];
    act(() => { returned = result.current.deleteSelection(); });
    expect(returned).toEqual([]);
    expect(helpers.batches).toEqual([]);
  });

  it('filter prunes the list before delete', () => {
    const helpers = makeAdapter(['a', 'b', 'c']);
    const { result } = renderHook(() =>
      useDelete(helpers.adapter, { filter: (ids) => ids.filter((i) => i !== 'b') }),
    );
    let returned: string[] = [];
    act(() => { returned = result.current.deleteSelection(); });
    expect(returned).toEqual(['a', 'c']);
    expect(helpers.batches[0].ops).toHaveLength(3); // 2 delete + 1 setSelection
  });

  it('filter returning [] suppresses the batch', () => {
    const helpers = makeAdapter(['a']);
    const { result } = renderHook(() =>
      useDelete(helpers.adapter, { filter: () => [] }),
    );
    let returned: string[] = ['sentinel'];
    act(() => { returned = result.current.deleteSelection(); });
    expect(returned).toEqual([]);
    expect(helpers.batches).toEqual([]);
  });

  it('custom label flows through', () => {
    const helpers = makeAdapter(['a']);
    const { result } = renderHook(() =>
      useDelete(helpers.adapter, { label: 'Remove seedling' }),
    );
    act(() => { result.current.deleteSelection(); });
    expect(helpers.batches[0].label).toBe('Remove seedling');
  });

  it('deleteSelection identity is stable across renders', () => {
    const helpers = makeAdapter(['a']);
    const { result, rerender } = renderHook(() => useDelete(helpers.adapter));
    const first = result.current.deleteSelection;
    rerender();
    expect(result.current.deleteSelection).toBe(first);
  });

  describe('enableKeyboard: true', () => {
    it('Delete key on document fires the action', () => {
      const helpers = makeAdapter(['a']);
      renderHook(() => useDelete(helpers.adapter, { enableKeyboard: true }));
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
      });
      expect(helpers.batches).toHaveLength(1);
    });

    it('Backspace also fires', () => {
      const helpers = makeAdapter(['a']);
      renderHook(() => useDelete(helpers.adapter, { enableKeyboard: true }));
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
      });
      expect(helpers.batches).toHaveLength(1);
    });

    it('Delete with meta key does NOT fire', () => {
      const helpers = makeAdapter(['a']);
      renderHook(() => useDelete(helpers.adapter, { enableKeyboard: true }));
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', metaKey: true, bubbles: true, cancelable: true }));
      });
      expect(helpers.batches).toEqual([]);
    });

    it('Delete on an <input> target does NOT fire', () => {
      const helpers = makeAdapter(['a']);
      renderHook(() => useDelete(helpers.adapter, { enableKeyboard: true }));
      const input = document.createElement('input');
      document.body.appendChild(input);
      try {
        const ev = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true });
        // jsdom: dispatching directly on the input bubbles to document, with target = input.
        act(() => { input.dispatchEvent(ev); });
        expect(helpers.batches).toEqual([]);
      } finally {
        document.body.removeChild(input);
      }
    });

    it('does NOT fire on contenteditable target', () => {
      const helpers = makeAdapter(['a']);
      renderHook(() => useDelete(helpers.adapter, { enableKeyboard: true }));
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');
      document.body.appendChild(div);
      try {
        const ev = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true });
        act(() => { div.dispatchEvent(ev); });
        expect(helpers.batches).toEqual([]);
      } finally {
        document.body.removeChild(div);
      }
    });

    it('preventDefault is called on a fire', () => {
      const helpers = makeAdapter(['a']);
      renderHook(() => useDelete(helpers.adapter, { enableKeyboard: true }));
      const ev = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true });
      act(() => { document.dispatchEvent(ev); });
      expect(ev.defaultPrevented).toBe(true);
    });
  });

  it('default (enableKeyboard: true): document keydown fires', () => {
    const helpers = makeAdapter(['a']);
    renderHook(() => useDelete(helpers.adapter));
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
    });
    expect(helpers.batches).toHaveLength(1);
  });

  it('enableKeyboard: false suppresses the document binding', () => {
    const helpers = makeAdapter(['a']);
    renderHook(() => useDelete(helpers.adapter, { enableKeyboard: false }));
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
    });
    expect(helpers.batches).toEqual([]);
  });

  it('listener is removed on unmount', () => {
    const helpers = makeAdapter(['a']);
    const { unmount } = renderHook(() => useDelete(helpers.adapter, { enableKeyboard: true }));
    unmount();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
    });
    expect(helpers.batches).toEqual([]);
  });
});
