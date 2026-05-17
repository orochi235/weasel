import { describe, it, expect } from 'vitest';
import { useEffect } from 'react';
import { render } from '@testing-library/react';
import { useReorder } from './reorder';
import { ActionsProvider, useActionsRegistry, type ActionsRegistry } from '../registry';
import type { Op } from 'core/ops/types';
import { asNodeId, type NodeId } from 'core/scene/types';

interface FakeAdapter {
  selection: NodeId[];
  parents: Record<string, string | null>;
  children: Record<string, string[]>;
  applied: Array<{ ops: Op[]; label: string }>;
  getSelection(): NodeId[];
  getParent(id: string): string | null;
  getChildren(parentId: string | null): string[];
  setChildOrder(parentId: string | null, ids: string[]): void;
  applyOps(ops: Op[], label: string): void;
}

function makeAdapter(): FakeAdapter {
  const a: FakeAdapter = {
    selection: [asNodeId('b')],
    parents: { a: null, b: null, c: null },
    children: { ROOT: ['a', 'b', 'c'] },
    applied: [],
    getSelection() { return this.selection.slice(); },
    getParent(id) { return this.parents[id] ?? null; },
    getChildren(parentId) { return (this.children[parentId ?? 'ROOT'] ?? []).slice(); },
    setChildOrder(parentId, ids) { this.children[parentId ?? 'ROOT'] = ids.slice(); },
    applyOps(ops, label) {
      this.applied.push({ ops, label });
      for (const op of ops) op.apply(this);
    },
  };
  return a;
}

describe('useReorder back-compat with ActionsProvider', () => {
  it('registers reorder.forward / backward / front / back in provider; unregisters on unmount', () => {
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
    expect(ids).toEqual(['reorder.back', 'reorder.backward', 'reorder.forward', 'reorder.front']);
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

  // REMOVED (Phase 14e Task 2.6): 'inside a provider, Shift+Mod+] still
  // bringToFront via standalone keybinding'. This test depended on the
  // legacy keydown loop firing for an action whose `gestureBinding` is now
  // unconditionally owned by the (unmounted-in-this-test) gesture
  // dispatcher. The hook-side fallback `useKeybinding` is gated on
  // `reg == null`, so registering the action via ActionsProvider correctly
  // disables it. The dispatcher itself is exercised by the
  // SceneCanvas-level tests.

  it('imperative bringForward() return still works inside a provider', () => {
    const adapter = makeAdapter();
    let imperative: (() => void) | undefined;
    function Host() { const r = useReorder(adapter); imperative = r.bringForward; return null; }
    render(<ActionsProvider><Host /></ActionsProvider>);
    imperative!();
    expect(adapter.applied).toHaveLength(1);
  });
});
