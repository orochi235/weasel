import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClipboardOps } from './clipboardOps';
import type { InsertAdapter, Op } from '../../..';
import { asNodeId } from 'core/scene/types';
import { PointerContextProvider, usePointerContext } from 'features/pointer/PointerContext';
import type { ReactNode } from 'react';
import { WEASEL_CLIPBOARD_MIME, WEASEL_CLIPBOARD_MIME_WEB, buildWeaselClipboardText } from './wireFormat';

interface Obj { id: string; x: number; y: number }

function makeAdapter(initial: { selection?: string[]; offsetOverride?: { dx: number; dy: number } } = {}) {
  let selection = [...(initial.selection ?? [])];
  let nextId = 0;
  const inserts: Obj[] = [];
  const batches: { ops: Op[]; label: string }[] = [];
  const pasteCtxLog: ({ dropPoint?: { worldX: number; worldY: number } } | undefined)[] = [];
  const adapter: InsertAdapter<Obj> = {
    commitInsert: () => null,
    commitPaste(clipboard, offset, ctx) {
      pasteCtxLog.push(ctx);
      const out: Obj[] = [];
      for (const raw of clipboard.items) {
        const src = raw as Obj;
        out.push({ id: `n${nextId++}`, x: src.x + offset.dx, y: src.y + offset.dy });
      }
      return out;
    },
    snapshotSelection(ids) {
      // For tests, build snapshots from a virtual pool that mirrors `inserts` plus seeded items.
      const pool = inserts;
      const items = pool.filter((p) => ids.includes(p.id));
      return { items };
    },
    getPasteOffset: initial.offsetOverride
      ? () => initial.offsetOverride!
      : () => ({ dx: 1, dy: 1 }),
    insertNode: (o) => { inserts.push(o); },
    setSelection: (ids) => { selection = [...ids]; },
    getSelection: () => selection,
    applyOps: (ops, label) => {
      batches.push({ ops, label });
      for (const op of ops) op.apply(adapter as never);
    },
  };
  return {
    adapter,
    inserts,
    batches,
    pasteCtxLog,
    getSelection: () => selection,
    seed(o: Obj) { inserts.push(o); selection = [o.id]; },
  };
}

describe('useClipboardOps', () => {
  it('isEmpty starts true', () => {
    const { adapter } = makeAdapter();
    const { result } = renderHook(() => useClipboardOps(adapter, { getSelection: () => [] }));
    expect(result.current.isEmpty()).toBe(true);
  });

  it('copy with empty selection no-ops; isEmpty stays true', () => {
    const { adapter } = makeAdapter();
    const { result } = renderHook(() => useClipboardOps(adapter, { getSelection: () => [] }));
    act(() => { result.current.copy(); });
    expect(result.current.isEmpty()).toBe(true);
  });

  it('paste with empty clipboard no-ops; no batch emitted', () => {
    const { adapter, batches } = makeAdapter();
    const { result } = renderHook(() => useClipboardOps(adapter, { getSelection: () => [] }));
    act(() => { result.current.paste(); });
    expect(batches).toEqual([]);
  });

  it('copy then paste emits one applyOps with N InsertOps + one SetSelectionOp', () => {
    const helpers = makeAdapter();
    helpers.seed({ id: 'a', x: 0, y: 0 });
    const { result } = renderHook(() =>
      useClipboardOps(helpers.adapter, { getSelection: () => [asNodeId('a')] }),
    );
    act(() => { result.current.copy(); });
    act(() => { result.current.paste(); });
    expect(helpers.batches).toHaveLength(1);
    expect(helpers.batches[0].label).toBe('Paste');
    // 1 InsertOp + 1 SetSelectionOp
    expect(helpers.batches[0].ops).toHaveLength(2);
    // Second op is a SetSelection op pointing at the new id 'n0'.
    expect(helpers.getSelection()).toEqual(['n0']);
  });

  it('cascading paste shifts each call by the offset', () => {
    const helpers = makeAdapter({ offsetOverride: { dx: 1, dy: 1 } });
    helpers.seed({ id: 'a', x: 0, y: 0 });
    const { result } = renderHook(() =>
      useClipboardOps(helpers.adapter, { getSelection: () => [asNodeId('a')] }),
    );
    act(() => { result.current.copy(); });
    act(() => { result.current.paste(); });
    act(() => { result.current.paste(); });
    // First paste: n0 at (1,1). Second paste should snapshot the just-pasted
    // n0 and offset by (1,1) again → n1 at (2,2).
    const made = helpers.inserts.filter((o) => o.id.startsWith('n'));
    expect(made.map((o) => ({ x: o.x, y: o.y }))).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);
  });

  it('honors options.getSelection over adapter.getSelection (which doesn\'t exist on InsertAdapter)', () => {
    const helpers = makeAdapter();
    helpers.seed({ id: 'a', x: 0, y: 0 });
    let calls = 0;
    const { result } = renderHook(() =>
      useClipboardOps(helpers.adapter, {
        getSelection: () => { calls += 1; return [asNodeId('a')]; },
      }),
    );
    act(() => { result.current.copy(); });
    expect(calls).toBeGreaterThan(0);
    expect(result.current.isEmpty()).toBe(false);
  });

  it('onPaste callback receives the new ids', () => {
    const helpers = makeAdapter();
    helpers.seed({ id: 'a', x: 0, y: 0 });
    const seen: string[][] = [];
    const { result } = renderHook(() =>
      useClipboardOps(helpers.adapter, {
        getSelection: () => [asNodeId('a')],
        onPaste: (ids) => seen.push(ids),
      }),
    );
    act(() => { result.current.copy(); });
    act(() => { result.current.paste(); });
    expect(seen).toEqual([['n0']]);
  });

  it('passes { dropPoint } as third arg when getDropPoint returns a point', () => {
    const helpers = makeAdapter();
    helpers.seed({ id: 'a', x: 0, y: 0 });
    const { result } = renderHook(() =>
      useClipboardOps(helpers.adapter, {
        getSelection: () => [asNodeId('a')],
        getDropPoint: () => ({ worldX: 50, worldY: 60 }),
      }),
    );
    act(() => { result.current.copy(); });
    act(() => { result.current.paste(); });
    expect(helpers.pasteCtxLog).toEqual([{ dropPoint: { worldX: 50, worldY: 60 } }]);
  });

  it('passes undefined ctx when getDropPoint returns null', () => {
    const helpers = makeAdapter();
    helpers.seed({ id: 'a', x: 0, y: 0 });
    const { result } = renderHook(() =>
      useClipboardOps(helpers.adapter, {
        getSelection: () => [asNodeId('a')],
        getDropPoint: () => null,
      }),
    );
    act(() => { result.current.copy(); });
    act(() => { result.current.paste(); });
    expect(helpers.pasteCtxLog).toEqual([undefined]);
  });

  it('omits ctx when getDropPoint option is not provided (regression)', () => {
    const helpers = makeAdapter();
    helpers.seed({ id: 'a', x: 0, y: 0 });
    const { result } = renderHook(() =>
      useClipboardOps(helpers.adapter, { getSelection: () => [asNodeId('a')] }),
    );
    act(() => { result.current.copy(); });
    act(() => { result.current.paste(); });
    expect(helpers.pasteCtxLog).toEqual([undefined]);
  });

  it('calls getDropPoint exactly once per paste()', () => {
    const helpers = makeAdapter();
    helpers.seed({ id: 'a', x: 0, y: 0 });
    let calls = 0;
    const { result } = renderHook(() =>
      useClipboardOps(helpers.adapter, {
        getSelection: () => [asNodeId('a')],
        getDropPoint: () => { calls++; return { worldX: 1, worldY: 2 }; },
      }),
    );
    act(() => { result.current.copy(); });
    act(() => { result.current.paste(); });
    expect(calls).toBe(1);
  });

  it('multiple pastes work when adapter state lags inserts (React-state adapter)', () => {
    // Regression: a React-backed adapter doesn't flush `setItems` synchronously
    // inside dispatchApplyBatch, so `snapshotSelection(newIds)` right after
    // commit would return empty. The hook must use `created` directly for the
    // next cascade source, not re-snapshot through the adapter.
    let nextId = 0;
    const inserts: { id: string; x: number; y: number }[] = [];
    // `snapshotSelection` reads `pool`, which is intentionally NOT updated by
    // `insertNode` (mimics React state that hasn't flushed yet).
    const pool: { id: string; x: number; y: number }[] = [{ id: 'a', x: 0, y: 0 }];
    const adapter: InsertAdapter<{ id: string; x: number; y: number }> = {
      commitInsert: () => null,
      commitPaste(clipboard, offset) {
        return (clipboard.items as { id: string; x: number; y: number }[]).map((src) => ({
          id: `n${nextId++}`, x: src.x + offset.dx, y: src.y + offset.dy,
        }));
      },
      snapshotSelection: (ids) => ({ items: pool.filter((p) => ids.includes(p.id)) }),
      getPasteOffset: () => ({ dx: 1, dy: 1 }),
      insertNode: (o) => { inserts.push(o); /* note: NOT pushed into pool */ },
      setSelection: () => {},
      getSelection: () => [asNodeId('a')],
    };
    const { result } = renderHook(() =>
      useClipboardOps(adapter, { getSelection: () => [asNodeId('a')] }),
    );
    act(() => { result.current.copy(); });
    act(() => { result.current.paste(); });
    act(() => { result.current.paste(); });
    act(() => { result.current.paste(); });
    expect(inserts.map((o) => ({ x: o.x, y: o.y }))).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ]);
  });

  it('still cascades: second paste reads the just-pasted ids as source', () => {
    const helpers = makeAdapter();
    helpers.seed({ id: 'a', x: 0, y: 0 });
    const { result } = renderHook(() =>
      useClipboardOps(helpers.adapter, {
        getSelection: () => [asNodeId('a')],
        getDropPoint: () => ({ worldX: 50, worldY: 60 }),
      }),
    );
    act(() => { result.current.copy(); });
    act(() => { result.current.paste(); });
    act(() => { result.current.paste(); });
    expect(helpers.pasteCtxLog).toHaveLength(2);
    expect(helpers.inserts.length).toBeGreaterThanOrEqual(2);
  });

  it('falls back to the surrounding PointerContext when no explicit getDropPoint is supplied', () => {
    const helpers = makeAdapter();
    helpers.seed({ id: 'a', x: 0, y: 0 });
    // Capture the context value so we can publish a synthetic pointer position
    // and observe it flowing through to commitPaste's ctx arg.
    let ctxHandle: ReturnType<typeof usePointerContext> = null;
    function ProbeAndPaste() {
      ctxHandle = usePointerContext();
      return null;
    }
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PointerContextProvider>
        <ProbeAndPaste />
        {children}
      </PointerContextProvider>
    );
    const { result } = renderHook(
      () => useClipboardOps(helpers.adapter, { getSelection: () => [asNodeId('a')] }),
      { wrapper },
    );
    // Publish a synthetic pointer position via the context's pointerRef.
    ctxHandle!.pointerRef.current = { worldX: 77, worldY: 88 };
    act(() => { result.current.copy(); });
    act(() => { result.current.paste(); });
    expect(helpers.pasteCtxLog).toEqual([{ dropPoint: { worldX: 77, worldY: 88 } }]);
  });

  it('explicit getDropPoint wins over the surrounding PointerContext', () => {
    const helpers = makeAdapter();
    helpers.seed({ id: 'a', x: 0, y: 0 });
    let ctxHandle: ReturnType<typeof usePointerContext> = null;
    function Probe() { ctxHandle = usePointerContext(); return null; }
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PointerContextProvider>
        <Probe />
        {children}
      </PointerContextProvider>
    );
    const { result } = renderHook(
      () => useClipboardOps(helpers.adapter, {
        getSelection: () => [asNodeId('a')],
        getDropPoint: () => ({ worldX: 1, worldY: 2 }),
      }),
      { wrapper },
    );
    ctxHandle!.pointerRef.current = { worldX: 999, worldY: 999 };
    act(() => { result.current.copy(); });
    act(() => { result.current.paste(); });
    expect(helpers.pasteCtxLog).toEqual([{ dropPoint: { worldX: 1, worldY: 2 } }]);
  });
});

describe('useClipboardOps — OS clipboard flavor seam', () => {
  // Real Chromium accepts only these MIME types unprefixed; every other type
  // must carry the "web " prefix or the ClipboardItem constructor throws.
  const WELL_KNOWN = new Set(['text/plain', 'text/html', 'image/png']);

  // Minimal jsdom stand-in for the real ClipboardItem — jsdom doesn't ship
  // one. Captures the constructor arg so tests can inspect the flavors a
  // write attempt carried, and — mirroring real Chromium — throws if any
  // type is neither well-known nor "web "-prefixed.
  class FakeClipboardItem {
    types: string[];
    private parts: Record<string, Blob>;
    constructor(items: Record<string, Blob>) {
      for (const mime of Object.keys(items)) {
        if (!WELL_KNOWN.has(mime) && !mime.startsWith('web ')) {
          throw new Error(`FakeClipboardItem: type "${mime}" requires the "web " prefix`);
        }
      }
      this.parts = items;
      this.types = Object.keys(items);
    }
    async getType(type: string): Promise<Blob> {
      const blob = this.parts[type];
      if (!blob) throw new Error(`FakeClipboardItem has no type "${type}"`);
      return blob;
    }
  }

  let hadClipboard = false;
  let originalClipboard: unknown;
  let hadClipboardItem = false;
  let originalClipboardItem: unknown;

  beforeEach(() => {
    hadClipboard = Object.prototype.hasOwnProperty.call(navigator, 'clipboard');
    originalClipboard = (navigator as unknown as { clipboard?: unknown }).clipboard;
    hadClipboardItem = Object.prototype.hasOwnProperty.call(globalThis, 'ClipboardItem');
    originalClipboardItem = (globalThis as unknown as { ClipboardItem?: unknown }).ClipboardItem;
    if (typeof (globalThis as unknown as { ClipboardItem?: unknown }).ClipboardItem === 'undefined') {
      (globalThis as unknown as { ClipboardItem: unknown }).ClipboardItem = FakeClipboardItem;
    }
  });

  afterEach(() => {
    if (hadClipboard) {
      Object.assign(navigator, { clipboard: originalClipboard });
    } else {
      delete (navigator as unknown as { clipboard?: unknown }).clipboard;
    }
    if (hadClipboardItem) {
      (globalThis as unknown as { ClipboardItem: unknown }).ClipboardItem = originalClipboardItem;
    } else {
      delete (globalThis as unknown as { ClipboardItem?: unknown }).ClipboardItem;
    }
  });

  // jsdom's Blob doesn't implement `.text()`/`.arrayBuffer()`; FileReader is
  // the one API jsdom does implement for reading Blob content synchronously
  // enough to await.
  function readBlobText(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
      reader.readAsText(blob);
    });
  }

  async function blobText(item: InstanceType<typeof FakeClipboardItem>, type: string): Promise<string> {
    return readBlobText(await item.getType(type));
  }

  it('(a) copy with default flavors calls write once with the web-prefixed custom MIME and text/plain', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { write } });
    const helpers = makeAdapter();
    helpers.seed({ id: 'a', x: 0, y: 0 });
    const { result } = renderHook(() =>
      useClipboardOps(helpers.adapter, { getSelection: () => [asNodeId('a')] }),
    );
    act(() => { result.current.copy(); });
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    const items = write.mock.calls[0][0] as InstanceType<typeof FakeClipboardItem>[];
    expect(items).toHaveLength(1);
    const item = items[0];
    expect(item.types).toContain(WEASEL_CLIPBOARD_MIME_WEB);
    expect(item.types).toContain('text/plain');
    const expected = buildWeaselClipboardText([{ id: 'a', x: 0, y: 0 }]);
    expect(await blobText(item, WEASEL_CLIPBOARD_MIME_WEB)).toBe(expected);
    expect(await blobText(item, 'text/plain')).toBe(expected);
  });

  it('(b) first write rejection retries with ONLY well-known flavors then resolves', async () => {
    const write = vi.fn()
      .mockRejectedValueOnce(new Error('custom format unsupported'))
      .mockResolvedValueOnce(undefined);
    Object.assign(navigator, { clipboard: { write } });
    const helpers = makeAdapter();
    helpers.seed({ id: 'a', x: 0, y: 0 });
    const { result } = renderHook(() =>
      useClipboardOps(helpers.adapter, { getSelection: () => [asNodeId('a')] }),
    );
    act(() => { result.current.copy(); });
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(2));
    const secondItem = write.mock.calls[1][0][0] as InstanceType<typeof FakeClipboardItem>;
    expect(secondItem.types).not.toContain(WEASEL_CLIPBOARD_MIME_WEB);
    expect(secondItem.types).not.toContain(WEASEL_CLIPBOARD_MIME);
    // Retry drops every non-well-known type outright — only 'text/plain'
    // survives from the default flavor map.
    expect(secondItem.types).toEqual(['text/plain']);
  });

  it('(c) both write rejections do not throw; in-memory paste still works', async () => {
    const write = vi.fn().mockRejectedValue(new Error('nope'));
    Object.assign(navigator, { clipboard: { write } });
    const helpers = makeAdapter();
    helpers.seed({ id: 'a', x: 0, y: 0 });
    const { result } = renderHook(() =>
      useClipboardOps(helpers.adapter, { getSelection: () => [asNodeId('a')] }),
    );
    expect(() => act(() => { result.current.copy(); })).not.toThrow();
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(2));
    act(() => { result.current.paste(); });
    expect(helpers.batches).toHaveLength(1);
  });

  it('(d) missing navigator.clipboard does not throw', () => {
    delete (navigator as unknown as { clipboard?: unknown }).clipboard;
    const helpers = makeAdapter();
    helpers.seed({ id: 'a', x: 0, y: 0 });
    const { result } = renderHook(() =>
      useClipboardOps(helpers.adapter, { getSelection: () => [asNodeId('a')] }),
    );
    expect(() => act(() => { result.current.copy(); })).not.toThrow();
    expect(result.current.isEmpty()).toBe(false);
  });

  it('(e) produceFlavors override with a non-well-known MIME (image/svg+xml) succeeds first-attempt, arriving web-prefixed', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { write } });
    const helpers = makeAdapter();
    helpers.seed({ id: 'a', x: 0, y: 0 });
    const { result } = renderHook(() =>
      useClipboardOps(helpers.adapter, {
        getSelection: () => [asNodeId('a')],
        produceFlavors: () => ({ 'image/svg+xml': '<svg/>' }),
      }),
    );
    act(() => { result.current.copy(); });
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    const item = write.mock.calls[0][0][0] as InstanceType<typeof FakeClipboardItem>;
    expect(item.types).toEqual(['web image/svg+xml']);
    expect(await blobText(item, 'web image/svg+xml')).toBe('<svg/>');
  });

  it('(f) produceFlavors returning an empty object skips the write entirely', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { write } });
    const helpers = makeAdapter();
    helpers.seed({ id: 'a', x: 0, y: 0 });
    const { result } = renderHook(() =>
      useClipboardOps(helpers.adapter, {
        getSelection: () => [asNodeId('a')],
        produceFlavors: () => ({}),
      }),
    );
    act(() => { result.current.copy(); });
    // Give the microtask/macrotask queue a chance to run; write must never fire.
    await new Promise((r) => setTimeout(r, 0));
    expect(write).not.toHaveBeenCalled();
  });

  it('(g) jsonReplacer reaches the default flavor builder', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { write } });
    const helpers = makeAdapter();
    helpers.seed({ id: 'a', x: 0, y: 0 });
    const replacer = (key: string, value: unknown) => (key === 'x' ? 'REPLACED' : value);
    const { result } = renderHook(() =>
      useClipboardOps(helpers.adapter, {
        getSelection: () => [asNodeId('a')],
        jsonReplacer: replacer,
      }),
    );
    act(() => { result.current.copy(); });
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    const item = write.mock.calls[0][0][0] as InstanceType<typeof FakeClipboardItem>;
    const text = await blobText(item, 'text/plain');
    expect(text).toBe(buildWeaselClipboardText([{ id: 'a', x: 0, y: 0 }], replacer));
    expect(text).toContain('REPLACED');
  });

  it('(h) a throwing produceFlavors does not throw from copy(); write never called; in-memory paste still works', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { write } });
    const helpers = makeAdapter();
    helpers.seed({ id: 'a', x: 0, y: 0 });
    const { result } = renderHook(() =>
      useClipboardOps(helpers.adapter, {
        getSelection: () => [asNodeId('a')],
        produceFlavors: () => { throw new Error('boom'); },
      }),
    );
    expect(() => act(() => { result.current.copy(); })).not.toThrow();
    // Give the microtask/macrotask queue a chance to run; write must never fire.
    await new Promise((r) => setTimeout(r, 0));
    expect(write).not.toHaveBeenCalled();
    act(() => { result.current.paste(); });
    expect(helpers.batches).toHaveLength(1);
  });
});
