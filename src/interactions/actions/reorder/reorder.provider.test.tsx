import { describe, it, expect, vi } from 'vitest';
import { useEffect } from 'react';
import { render } from '@testing-library/react';
import { useReorder } from './reorder';
import { ActionsProvider, useActionsRegistry, type ActionsRegistry } from '../registry';
import type { Op } from '../../../core/ops/types';

interface FakeAdapter {
  selection: string[];
  parents: Record<string, string | null>;
  children: Record<string, string[]>;
  applied: Array<{ ops: Op[]; label: string }>;
  getSelection(): string[];
  getParent(id: string): string | null;
  getChildren(parentId: string | null): string[];
  setChildOrder(parentId: string | null, ids: string[]): void;
  applyBatch(ops: Op[], label: string): void;
}

function makeAdapter(): FakeAdapter {
  const a: FakeAdapter = {
    selection: ['b'],
    parents: { a: null, b: null, c: null },
    children: { ROOT: ['a', 'b', 'c'] },
    applied: [],
    getSelection() { return this.selection.slice(); },
    getParent(id) { return this.parents[id] ?? null; },
    getChildren(parentId) { return (this.children[parentId ?? 'ROOT'] ?? []).slice(); },
    setChildOrder(parentId, ids) { this.children[parentId ?? 'ROOT'] = ids.slice(); },
    applyBatch(ops, label) {
      this.applied.push({ ops, label });
      for (const op of ops) op.apply(this);
    },
  };
  return a;
}

describe('useReorder back-compat with ActionsProvider', () => {
  it('registers reorder.forward and reorder.backward in provider; unregisters on unmount', () => {
    let regSnap: ActionsRegistry | null = null;
    function Probe() { const r = useActionsRegistry(); useEffect(() => { regSnap = r; }); return null; }
    const adapter = makeAdapter();
    function Host() { useReorder(adapter); return null; }
    const { unmount, rerender } = render(
      <ActionsProvider>
        <Host />
        <Probe />
      </ActionsProvider>,
    );
    const ids = regSnap!.list().filter(a => a.id.startsWith('reorder.')).map(a => a.id).sort();
    expect(ids).toEqual(['reorder.backward', 'reorder.forward']);
    rerender(<ActionsProvider><Probe /></ActionsProvider>);
    expect(regSnap!.list().filter(a => a.id.startsWith('reorder.'))).toHaveLength(0);
    unmount();
  });

  it('falls back to direct keydown listener when no provider is in scope', () => {
    const adapter = makeAdapter();
    function Host() { useReorder(adapter); return null; }
    render(<Host />);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ']', metaKey: true, bubbles: true }));
    expect(adapter.applied).toHaveLength(1);
  });

  it('inside a provider, Shift+Mod+] still bringToFront via standalone keybinding', () => {
    // Front/back variants are deferred from the registry; the hook keeps
    // its own keybinding for those, always-on regardless of provider.
    const adapter = makeAdapter();
    function Host() { useReorder(adapter); return null; }
    render(<ActionsProvider><Host /></ActionsProvider>);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ']', metaKey: true, shiftKey: true, bubbles: true }));
    // bringToFront on selection ['b'] in children ROOT=['a','b','c'] → ['a','c','b']
    expect(adapter.children.ROOT).toEqual(['a', 'c', 'b']);
  });

  it('imperative bringForward() return still works inside a provider', () => {
    const adapter = makeAdapter();
    let imperative: (() => void) | undefined;
    function Host() { const r = useReorder(adapter); imperative = r.bringForward; return null; }
    render(<ActionsProvider><Host /></ActionsProvider>);
    imperative!();
    expect(adapter.applied).toHaveLength(1);
  });
});
