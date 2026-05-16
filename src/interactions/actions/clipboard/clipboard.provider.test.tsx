import { describe, it, expect } from 'vitest';
import { useEffect } from 'react';
import { render } from '@testing-library/react';
import { useClipboard } from './clipboard';
import type { ClipboardAdapter } from './clipboard';
import { ActionsProvider, useActionsRegistry, type ActionsRegistry } from '../registry';
import type { Op } from 'core/ops/types';
import { asNodeId } from 'core/scene/types';

interface Obj { id: string; x: number; y: number }

function makeAdapter() {
  let selection: string[] = [];
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
    getPasteOffset: () => ({ dx: 1, dy: 1 }),
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
    seed(o: Obj) { pool.push(o); selection = [o.id]; },
  };
}

describe('useClipboard back-compat with ActionsProvider', () => {
  it('registers three actions (copy/cut/paste) when wrapped in ActionsProvider', () => {
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    const { adapter } = makeAdapter();
    function Host() {
      useClipboard(adapter, { getSelection: () => [] });
      return null;
    }
    const { unmount, rerender } = render(
      <ActionsProvider><Host /><Probe /></ActionsProvider>,
    );
    const ids = regSnap!.list().map((a) => a.id);
    expect(ids).toContain('clipboard.copy');
    expect(ids).toContain('clipboard.cut');
    expect(ids).toContain('clipboard.paste');
    rerender(<ActionsProvider><Probe /></ActionsProvider>);
    expect(regSnap!.list().some((a) => a.id.startsWith('clipboard.'))).toBe(false);
    unmount();
  });

  it('registered actions carry the expected labels and bindings', () => {
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    const { adapter } = makeAdapter();
    function Host() {
      useClipboard(adapter, { getSelection: () => [] });
      return null;
    }
    render(<ActionsProvider><Host /><Probe /></ActionsProvider>);
    const copy = regSnap!.list().find((a) => a.id === 'clipboard.copy')!;
    const cut = regSnap!.list().find((a) => a.id === 'clipboard.cut')!;
    const paste = regSnap!.list().find((a) => a.id === 'clipboard.paste')!;
    expect(copy.label).toBe('Copy');
    expect(cut.label).toBe('Cut');
    expect(paste.label).toBe('Paste');
    expect(copy.defaultBinding).toEqual({ key: 'c', mod: true });
    expect(cut.defaultBinding).toEqual({ key: 'x', mod: true });
    expect(paste.defaultBinding).toEqual({ key: 'v', mod: true });
  });

  it('document Mod+X fires exactly once inside a provider (registry dispatches; no double-fire)', () => {
    const helpers = makeAdapter();
    helpers.seed({ id: 'a', x: 0, y: 0 });
    function Host() {
      useClipboard(helpers.adapter, { getSelection: () => [asNodeId('a')] });
      return null;
    }
    render(<ActionsProvider><Host /></ActionsProvider>);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', metaKey: true, bubbles: true, cancelable: true }));
    expect(helpers.batches).toHaveLength(1);
    expect(helpers.batches[0].label).toBe('Cut');
  });

  it('falls back to direct keydown listeners when no provider is in scope', () => {
    const helpers = makeAdapter();
    helpers.seed({ id: 'a', x: 0, y: 0 });
    function Host() {
      useClipboard(helpers.adapter, { getSelection: () => [asNodeId('a')] });
      return null;
    }
    render(<Host />);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', metaKey: true, bubbles: true, cancelable: true }));
    expect(helpers.batches).toHaveLength(1);
    expect(helpers.batches[0].label).toBe('Cut');
  });

  it('enableKeyboard: false skips registration', () => {
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    const { adapter } = makeAdapter();
    function Host() {
      useClipboard(adapter, { getSelection: () => [], enableKeyboard: false });
      return null;
    }
    render(<ActionsProvider><Host /><Probe /></ActionsProvider>);
    expect(regSnap!.list().some((a) => a.id.startsWith('clipboard.'))).toBe(false);
  });
});
