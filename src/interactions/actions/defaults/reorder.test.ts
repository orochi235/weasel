import { describe, it, expect, vi } from 'vitest';
import { defaultReorderActions, reorderForwardAction, reorderBackwardAction } from './reorder';
import type { Op } from 'core/ops/types';
import { asNodeId, type NodeId } from 'core/scene/types';
import type { BoundGesture } from '../registry';
import type { ImmediateInvoker } from '../invoker';

// ---------------------------------------------------------------------------
// Shared fake adapter helpers
// ---------------------------------------------------------------------------

interface FakeAdapter {
  selection: NodeId[];
  parents: Record<string, string | null>;
  children: Record<string, string[]>;
  getSelection(): NodeId[];
  getParent(id: string): string | null;
  getChildren(parentId: string | null): string[];
  setChildOrder(parentId: string | null, ids: string[]): void;
}

function makeAdapter(): FakeAdapter {
  return {
    selection: [asNodeId('b')],
    parents: { a: null, b: null, c: null },
    children: { ROOT: ['a', 'b', 'c'] },
    getSelection() { return this.selection.slice(); },
    getParent(id: string) { return this.parents[id] ?? null; },
    getChildren(parentId: string | null) { return (this.children[parentId ?? 'ROOT'] ?? []).slice(); },
    setChildOrder(parentId: string | null, ids: string[]) { this.children[parentId ?? 'ROOT'] = ids.slice(); },
  };
}

// ---------------------------------------------------------------------------
// Minimal Scene mock for the descriptor invoker
// ---------------------------------------------------------------------------

interface SceneMock {
  roots: NodeId[];
  childrenOf: ReturnType<typeof vi.fn>;
  reorder: ReturnType<typeof vi.fn>;
  batch: ReturnType<typeof vi.fn>;
}

function makeScene(rootIds: string[]): SceneMock {
  const roots = rootIds.map(asNodeId);
  const reorder = vi.fn();

  return {
    roots,
    childrenOf: vi.fn().mockReturnValue([]),
    reorder,
    batch: vi.fn((_, fn: () => void) => fn()),
  };
}

function makeSelection(ids: string[]) {
  return {
    get: () => ids.map(asNodeId),
    current: [] as readonly NodeId[],
    set: vi.fn(), add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), clear: vi.fn(),
    contains: vi.fn().mockReturnValue(false),
  };
}

// ---------------------------------------------------------------------------
// reorderForwardAction (Phase 4 descriptor)
// ---------------------------------------------------------------------------

describe('reorderForwardAction (descriptor)', () => {
  it('has id "reorder.forward"', () => {
    expect(reorderForwardAction.id).toBe('reorder.forward');
  });

  it('label is "Bring Forward"', () => {
    expect(reorderForwardAction.label).toBe('Bring Forward');
  });

  it('declares two parametric gestureBinding entries', () => {
    expect(Array.isArray(reorderForwardAction.gestureBinding)).toBe(true);
    expect((reorderForwardAction.gestureBinding as unknown[]).length).toBe(2);
  });

  it('first binding carries distance: "adjacent" and key Mod+]', () => {
    const bindings = reorderForwardAction.gestureBinding as BoundGesture[];
    const first = bindings[0] as { spec: { kind: string; key: unknown; mods: unknown }; opts: { params: { distance: string } } };
    expect(first.opts.params.distance).toBe('adjacent');
    expect(first.spec.kind).toBe('key');
    expect(first.spec.key).toEqual([']', '}']);
    expect(first.spec.mods).toEqual({ mod: true });
  });

  it('second binding carries distance: "extreme" and key Mod+Shift+]', () => {
    const bindings = reorderForwardAction.gestureBinding as BoundGesture[];
    const second = bindings[1] as { spec: { kind: string; key: unknown; mods: unknown }; opts: { params: { distance: string } } };
    expect(second.opts.params.distance).toBe('extreme');
    expect(second.spec.kind).toBe('key');
    expect(second.spec.key).toEqual([']', '}']);
    expect(second.spec.mods).toEqual({ mod: true, shift: true });
  });

  it('has timing "immediate"', () => {
    expect(reorderForwardAction.invoker?.timing).toBe('immediate');
  });

  it('invoker.run with distance "adjacent" moves selection one step forward', () => {
    // roots: ['a', 'b', 'c'] — b selected — result after bringForward: ['a', 'c', 'b']
    const scene = makeScene(['a', 'b', 'c']);
    const selection = makeSelection(['b']);

    (reorderForwardAction.invoker as ImmediateInvoker).run(
      { selection, scene } as import('../invoker').ActionDeps,
      { distance: 'adjacent' },
    );

    // batch is called once; reorder is called for positions that changed
    expect(scene.batch).toHaveBeenCalledOnce();
    // After bringForward(['a','b','c'], ['b']) → ['a','c','b']
    // setChildOrder iterates: index 0='a' (unchanged), index 1='c' (changed), index 2='b' (changed)
    // scene.reorder called for 'c' at 1 and 'b' at 2
    expect(scene.reorder).toHaveBeenCalledWith(asNodeId('c'), 1);
    expect(scene.reorder).toHaveBeenCalledWith(asNodeId('b'), 2);
  });

  it('invoker.run with distance "extreme" moves selection to front', () => {
    // roots: ['a', 'b', 'c'] — b selected — result after bringToFront: ['a', 'c', 'b']
    const scene = makeScene(['a', 'b', 'c']);
    const selection = makeSelection(['b']);

    (reorderForwardAction.invoker as ImmediateInvoker).run(
      { selection, scene } as import('../invoker').ActionDeps,
      { distance: 'extreme' },
    );

    expect(scene.batch).toHaveBeenCalledOnce();
    // bringToFront(['a','b','c'], ['b']) → ['a','c','b'] — same result for a single item
    expect(scene.reorder).toHaveBeenCalledWith(asNodeId('c'), 1);
    expect(scene.reorder).toHaveBeenCalledWith(asNodeId('b'), 2);
  });

  it('invoker.run defaults to "adjacent" when params is undefined', () => {
    const scene = makeScene(['a', 'b', 'c']);
    const selection = makeSelection(['b']);

    (reorderForwardAction.invoker as ImmediateInvoker).run(
      { selection, scene } as import('../invoker').ActionDeps,
      undefined,
    );

    expect(scene.batch).toHaveBeenCalledOnce();
  });

  it('invoker.run is a no-op on empty selection', () => {
    const scene = makeScene(['a', 'b', 'c']);
    const selection = makeSelection([]);

    (reorderForwardAction.invoker as ImmediateInvoker).run(
      { selection, scene } as import('../invoker').ActionDeps,
      { distance: 'adjacent' },
    );

    expect(scene.batch).not.toHaveBeenCalled();
    expect(scene.reorder).not.toHaveBeenCalled();
  });

  it('invoker.run is a no-op when deps are missing', () => {
    expect(() => {
      (reorderForwardAction.invoker as ImmediateInvoker).run({}, { distance: 'adjacent' });
    }).not.toThrow();
  });

  it('enabled returns SelectionRequired', () => {
    expect(reorderForwardAction.enabled!()).toBe('selection-required');
  });
});

// ---------------------------------------------------------------------------
// reorderBackwardAction (Phase 4 descriptor)
// ---------------------------------------------------------------------------

describe('reorderBackwardAction (descriptor)', () => {
  it('has id "reorder.backward"', () => {
    expect(reorderBackwardAction.id).toBe('reorder.backward');
  });

  it('label is "Send Backward"', () => {
    expect(reorderBackwardAction.label).toBe('Send Backward');
  });

  it('declares two parametric gestureBinding entries', () => {
    expect(Array.isArray(reorderBackwardAction.gestureBinding)).toBe(true);
    expect((reorderBackwardAction.gestureBinding as unknown[]).length).toBe(2);
  });

  it('first binding carries distance: "adjacent" and key Mod+[', () => {
    const bindings = reorderBackwardAction.gestureBinding as BoundGesture[];
    const first = bindings[0] as { spec: { kind: string; key: unknown; mods: unknown }; opts: { params: { distance: string } } };
    expect(first.opts.params.distance).toBe('adjacent');
    expect(first.spec.kind).toBe('key');
    expect(first.spec.key).toEqual(['[', '{']);
    expect(first.spec.mods).toEqual({ mod: true });
  });

  it('second binding carries distance: "extreme" and key Mod+Shift+[', () => {
    const bindings = reorderBackwardAction.gestureBinding as BoundGesture[];
    const second = bindings[1] as { spec: { kind: string; key: unknown; mods: unknown }; opts: { params: { distance: string } } };
    expect(second.opts.params.distance).toBe('extreme');
    expect(second.spec.kind).toBe('key');
    expect(second.spec.key).toEqual(['[', '{']);
    expect(second.spec.mods).toEqual({ mod: true, shift: true });
  });

  it('has timing "immediate"', () => {
    expect(reorderBackwardAction.invoker?.timing).toBe('immediate');
  });

  it('invoker.run with distance "adjacent" moves selection one step backward', () => {
    // roots: ['a', 'b', 'c'] — b selected — result after sendBackward: ['b', 'a', 'c']
    const scene = makeScene(['a', 'b', 'c']);
    const selection = makeSelection(['b']);

    (reorderBackwardAction.invoker as ImmediateInvoker).run(
      { selection, scene } as import('../invoker').ActionDeps,
      { distance: 'adjacent' },
    );

    expect(scene.batch).toHaveBeenCalledOnce();
    // sendBackward(['a','b','c'], ['b']) → ['b','a','c']
    expect(scene.reorder).toHaveBeenCalledWith(asNodeId('b'), 0);
    expect(scene.reorder).toHaveBeenCalledWith(asNodeId('a'), 1);
  });

  it('invoker.run with distance "extreme" moves selection to back', () => {
    // roots: ['a', 'b', 'c'] — b selected — sendToBack → ['b', 'a', 'c']
    const scene = makeScene(['a', 'b', 'c']);
    const selection = makeSelection(['b']);

    (reorderBackwardAction.invoker as ImmediateInvoker).run(
      { selection, scene } as import('../invoker').ActionDeps,
      { distance: 'extreme' },
    );

    expect(scene.batch).toHaveBeenCalledOnce();
    expect(scene.reorder).toHaveBeenCalledWith(asNodeId('b'), 0);
  });

  it('invoker.run defaults to "adjacent" when params is undefined', () => {
    const scene = makeScene(['a', 'b', 'c']);
    const selection = makeSelection(['b']);

    (reorderBackwardAction.invoker as ImmediateInvoker).run(
      { selection, scene } as import('../invoker').ActionDeps,
      undefined,
    );

    expect(scene.batch).toHaveBeenCalledOnce();
  });

  it('invoker.run is a no-op on empty selection', () => {
    const scene = makeScene(['a', 'b', 'c']);
    const selection = makeSelection([]);

    (reorderBackwardAction.invoker as ImmediateInvoker).run(
      { selection, scene } as import('../invoker').ActionDeps,
      { distance: 'adjacent' },
    );

    expect(scene.batch).not.toHaveBeenCalled();
    expect(scene.reorder).not.toHaveBeenCalled();
  });

  it('invoker.run is a no-op when deps are missing', () => {
    expect(() => {
      (reorderBackwardAction.invoker as ImmediateInvoker).run({}, { distance: 'adjacent' });
    }).not.toThrow();
  });

  it('enabled returns SelectionRequired', () => {
    expect(reorderBackwardAction.enabled!()).toBe('selection-required');
  });
});

// ---------------------------------------------------------------------------
// defaultReorderActions (legacy bridge)
// ---------------------------------------------------------------------------

describe('defaultReorderActions', () => {
  it('returns 4 actions: reorder.forward / backward / front / back', () => {
    const acts = defaultReorderActions({ getSelection: () => [asNodeId('a')], applyOps: vi.fn() });
    expect(acts.map(a => a.id).sort()).toEqual(['reorder.back', 'reorder.backward', 'reorder.forward', 'reorder.front']);
  });
  // Per-action gestureBinding tests below cover the binding shape; the legacy
  // `defaultBinding` assertions are redundant and were removed in phase 14e/T6.
  it('forward gestureBinding = key(]/}, mod)', () => {
    const a = defaultReorderActions({ getSelection: () => [asNodeId('a')], applyOps: vi.fn() }).find(x => x.id === 'reorder.forward')!;
    expect(a.gestureBinding).toEqual({ kind: 'key', key: [']', '}'], mods: { mod: true } });
  });
  it('backward gestureBinding = key([/{, mod)', () => {
    const a = defaultReorderActions({ getSelection: () => [asNodeId('a')], applyOps: vi.fn() }).find(x => x.id === 'reorder.backward')!;
    expect(a.gestureBinding).toEqual({ kind: 'key', key: ['[', '{'], mods: { mod: true } });
  });
  it('forward run() emits a reorder op that brings selected ids forward', () => {
    const adapter = makeAdapter();
    const applyOps = vi.fn((ops: Op[]) => { for (const op of ops) op.apply(adapter); });
    defaultReorderActions({ getSelection: () => adapter.selection, applyOps })
      .find(a => a.id === 'reorder.forward')!.run!();
    expect(applyOps).toHaveBeenCalledOnce();
    expect(adapter.children.ROOT).toEqual(['a', 'c', 'b']);
  });
  it('backward run() emits a reorder op that sends selected ids backward', () => {
    const adapter = makeAdapter();
    const applyOps = vi.fn((ops: Op[]) => { for (const op of ops) op.apply(adapter); });
    defaultReorderActions({ getSelection: () => adapter.selection, applyOps })
      .find(a => a.id === 'reorder.backward')!.run!();
    expect(adapter.children.ROOT).toEqual(['b', 'a', 'c']);
  });
  it('run() is a no-op on empty selection', () => {
    const applyOps = vi.fn();
    defaultReorderActions({ getSelection: () => [], applyOps })
      .find(a => a.id === 'reorder.forward')!.run!();
    expect(applyOps).not.toHaveBeenCalled();
  });
  it('front gestureBinding = key(]/}, mod, shift)', () => {
    const a = defaultReorderActions({ getSelection: () => [asNodeId('a')], applyOps: vi.fn() }).find(x => x.id === 'reorder.front')!;
    expect(a.gestureBinding).toEqual({ kind: 'key', key: [']', '}'], mods: { mod: true, shift: true } });
  });
  it('back gestureBinding = key([/{, mod, shift)', () => {
    const a = defaultReorderActions({ getSelection: () => [asNodeId('a')], applyOps: vi.fn() }).find(x => x.id === 'reorder.back')!;
    expect(a.gestureBinding).toEqual({ kind: 'key', key: ['[', '{'], mods: { mod: true, shift: true } });
  });
});
