import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClipboard } from './clipboard';
import type { ClipboardAdapter } from './clipboard';
import type { Op } from '../../..';
import { asNodeId } from 'core/scene/types';

interface Obj { id: string; x: number; y: number }

function makeAdapter(initial: { selection?: string[]; offset?: { dx: number; dy: number } } = {}) {
  let selection = [...(initial.selection ?? [])];
  let nextId = 0;
  const pool: Obj[] = [];
  const batches: { ops: Op[]; label: string }[] = [];
  const adapter: ClipboardAdapter<Obj> = {
    commitInsert: () => null,
    commitPaste(clipboard, offset) {
      const out: Obj[] = [];
      for (const raw of clipboard.items) {
        const src = raw as Obj;
        out.push({ id: `n${nextId++}`, x: src.x + offset.dx, y: src.y + offset.dy });
      }
      return out;
    },
    snapshotSelection(ids) {
      return { items: pool.filter((p) => ids.includes(p.id)) };
    },
    getPasteOffset: () => initial.offset ?? { dx: 1, dy: 1 },
    getNode: (id) => pool.find((p) => p.id === id),
    getNodeIndex: (id) => pool.findIndex((p) => p.id === id),
    insertNode: (o) => { pool.push(o); },
    removeNode: (id) => {
      const i = pool.findIndex((p) => p.id === id);
      if (i >= 0) pool.splice(i, 1);
    },
    setSelection: (ids) => { selection = [...ids]; },
    getSelection: () => selection,
    applyOps: (ops, label) => {
      batches.push({ ops, label });
      for (const op of ops) op.apply(adapter as never);
    },
  };
  return {
    adapter,
    pool,
    batches,
    getSelection: () => selection,
    seed(o: Obj) { pool.push(o); selection = [o.id]; },
  };
}

describe('useClipboard', () => {
  it('exposes copy / cut / paste / isEmpty; isEmpty starts true', () => {
    const { adapter } = makeAdapter();
    const { result } = renderHook(() =>
      useClipboard(adapter, { getSelection: () => [] }),
    );
    expect(typeof result.current.copy).toBe('function');
    expect(typeof result.current.cut).toBe('function');
    expect(typeof result.current.paste).toBe('function');
    expect(result.current.isEmpty()).toBe(true);
  });

  it('copy snapshots selection without emitting a batch', () => {
    const helpers = makeAdapter();
    helpers.seed({ id: 'a', x: 0, y: 0 });
    const { result } = renderHook(() =>
      useClipboard(helpers.adapter, { getSelection: () => [asNodeId('a')] }),
    );
    act(() => { result.current.copy(); });
    expect(helpers.batches).toEqual([]);
    expect(result.current.isEmpty()).toBe(false);
  });

  it('paste flows through to InsertOps + SetSelection like useClipboardOps', () => {
    const helpers = makeAdapter();
    helpers.seed({ id: 'a', x: 0, y: 0 });
    const { result } = renderHook(() =>
      useClipboard(helpers.adapter, { getSelection: () => [asNodeId('a')] }),
    );
    act(() => { result.current.copy(); });
    act(() => { result.current.paste(); });
    expect(helpers.batches).toHaveLength(1);
    expect(helpers.batches[0].label).toBe('Paste');
    expect(helpers.batches[0].ops).toHaveLength(2);
  });

  describe('cut', () => {
    it('snapshots, then deletes originals + clears selection in one batch', () => {
      const helpers = makeAdapter();
      helpers.seed({ id: 'a', x: 5, y: 7 });
      const { result } = renderHook(() =>
        useClipboard(helpers.adapter, { getSelection: () => [asNodeId('a')] }),
      );
      let returned: string[] = [];
      act(() => { returned = result.current.cut(); });
      expect(returned).toEqual(['a']);
      expect(helpers.batches).toHaveLength(1);
      expect(helpers.batches[0].label).toBe('Cut');
      expect(helpers.batches[0].ops).toHaveLength(2); // 1 delete + 1 setSelection
      expect(helpers.pool.find((p) => p.id === 'a')).toBeUndefined();
      expect(result.current.isEmpty()).toBe(false); // clipboard now holds 'a'
    });

    it('empty selection: no batch, returns []', () => {
      const helpers = makeAdapter();
      const { result } = renderHook(() =>
        useClipboard(helpers.adapter, { getSelection: () => [] }),
      );
      let returned: string[] = ['sentinel'];
      act(() => { returned = result.current.cut(); });
      expect(returned).toEqual([]);
      expect(helpers.batches).toEqual([]);
      expect(result.current.isEmpty()).toBe(true);
    });

    it('cut then paste round-trips the object (with paste offset)', () => {
      const helpers = makeAdapter({ offset: { dx: 2, dy: 3 } });
      helpers.seed({ id: 'a', x: 10, y: 20 });
      const { result } = renderHook(() =>
        useClipboard(helpers.adapter, { getSelection: () => [asNodeId('a')] }),
      );
      act(() => { result.current.cut(); });
      act(() => { result.current.paste(); });
      const newObj = helpers.pool.find((p) => p.id === 'n0');
      expect(newObj).toEqual({ id: 'n0', x: 12, y: 23 });
    });

    it('custom cutLabel flows through', () => {
      const helpers = makeAdapter();
      helpers.seed({ id: 'a', x: 0, y: 0 });
      const { result } = renderHook(() =>
        useClipboard(helpers.adapter, {
          getSelection: () => [asNodeId('a')],
          cutLabel: 'Cut node',
        }),
      );
      act(() => { result.current.cut(); });
      expect(helpers.batches[0].label).toBe('Cut node');
    });

    it('falls back to stub object when getNode is omitted', () => {
      const helpers = makeAdapter();
      helpers.seed({ id: 'a', x: 0, y: 0 });
      // strip getNode
      const adapter = { ...helpers.adapter };
      delete (adapter as { getNode?: unknown }).getNode;
      const { result } = renderHook(() =>
        useClipboard(adapter, { getSelection: () => [asNodeId('a')] }),
      );
      act(() => { result.current.cut(); });
      expect(helpers.batches).toHaveLength(1);
      // Op still runs; the stub satisfies removeNode(id).
      expect(helpers.pool.find((p) => p.id === 'a')).toBeUndefined();
    });
  });

  describe('enableKeyboard: true (default)', () => {
    function fire(key: string, opts: KeyboardEventInit = {}) {
      const ev = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        ...opts,
      });
      document.dispatchEvent(ev);
      return ev;
    }

    it('Mod+C triggers copy', () => {
      const helpers = makeAdapter();
      helpers.seed({ id: 'a', x: 0, y: 0 });
      const { result } = renderHook(() =>
        useClipboard(helpers.adapter, {
          getSelection: () => [asNodeId('a')],
          enableKeyboard: true,
        }),
      );
      act(() => { fire('c', { metaKey: true }); });
      expect(result.current.isEmpty()).toBe(false);
      expect(helpers.batches).toEqual([]); // copy is silent
    });

    it('Mod+X triggers cut', () => {
      const helpers = makeAdapter();
      helpers.seed({ id: 'a', x: 0, y: 0 });
      renderHook(() =>
        useClipboard(helpers.adapter, {
          getSelection: () => [asNodeId('a')],
          enableKeyboard: true,
        }),
      );
      act(() => { fire('x', { metaKey: true }); });
      expect(helpers.batches).toHaveLength(1);
      expect(helpers.batches[0].label).toBe('Cut');
    });

    it('Mod+V triggers paste', () => {
      const helpers = makeAdapter();
      helpers.seed({ id: 'a', x: 0, y: 0 });
      const { result } = renderHook(() =>
        useClipboard(helpers.adapter, {
          getSelection: () => [asNodeId('a')],
          enableKeyboard: true,
        }),
      );
      act(() => { result.current.copy(); });
      act(() => { fire('v', { metaKey: true }); });
      expect(helpers.batches).toHaveLength(1);
      expect(helpers.batches[0].label).toBe('Paste');
    });

    it('Ctrl modifier also fires (cross-platform)', () => {
      const helpers = makeAdapter();
      helpers.seed({ id: 'a', x: 0, y: 0 });
      renderHook(() =>
        useClipboard(helpers.adapter, {
          getSelection: () => [asNodeId('a')],
          enableKeyboard: true,
        }),
      );
      act(() => { fire('x', { ctrlKey: true }); });
      expect(helpers.batches).toHaveLength(1);
    });

    it('plain c (no modifier) does NOT fire', () => {
      const helpers = makeAdapter();
      helpers.seed({ id: 'a', x: 0, y: 0 });
      const { result } = renderHook(() =>
        useClipboard(helpers.adapter, {
          getSelection: () => [asNodeId('a')],
          enableKeyboard: true,
        }),
      );
      act(() => { fire('c'); });
      expect(result.current.isEmpty()).toBe(true);
    });

    it('skips when focus is in an editable element', () => {
      const helpers = makeAdapter();
      helpers.seed({ id: 'a', x: 0, y: 0 });
      renderHook(() =>
        useClipboard(helpers.adapter, {
          getSelection: () => [asNodeId('a')],
          enableKeyboard: true,
        }),
      );
      const input = document.createElement('input');
      document.body.appendChild(input);
      try {
        const ev = new KeyboardEvent('keydown', {
          key: 'x',
          metaKey: true,
          bubbles: true,
          cancelable: true,
        });
        act(() => { input.dispatchEvent(ev); });
        expect(helpers.batches).toEqual([]);
      } finally {
        document.body.removeChild(input);
      }
    });

    it('preventDefault is called on a fire', () => {
      const helpers = makeAdapter();
      helpers.seed({ id: 'a', x: 0, y: 0 });
      renderHook(() =>
        useClipboard(helpers.adapter, {
          getSelection: () => [asNodeId('a')],
          enableKeyboard: true,
        }),
      );
      let ev: KeyboardEvent;
      act(() => { ev = fire('c', { metaKey: true }); });
      expect(ev!.defaultPrevented).toBe(true);
    });
  });

  it('enableKeyboard: false suppresses Mod+C', () => {
    const helpers = makeAdapter();
    helpers.seed({ id: 'a', x: 0, y: 0 });
    const { result } = renderHook(() =>
      useClipboard(helpers.adapter, {
        getSelection: () => [asNodeId('a')],
        enableKeyboard: false,
      }),
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'c', metaKey: true, bubbles: true, cancelable: true,
      }));
    });
    expect(result.current.isEmpty()).toBe(true);
  });
});
