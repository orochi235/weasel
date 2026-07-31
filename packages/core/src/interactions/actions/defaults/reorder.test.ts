import { describe, it, expect, vi, type Mock } from 'vitest';
import { reorderForwardAction, reorderBackwardAction } from './reorder';
import { asNodeId, type NodeId } from 'core/scene/types';
import type { BoundGesture } from '../registry';
import type { ImmediateInvoker } from '../invoker';
import type { Op } from 'core/ops/types';
import { matchSpec } from '@weasel-js/gestures';
import type { InputEvent, ModifiersEvent } from '@weasel-js/gestures';

// ---------------------------------------------------------------------------
// Minimal Scene mock for the descriptor invoker
// ---------------------------------------------------------------------------

interface SceneMock {
  readonly roots: NodeId[];
  get: Mock;
  childrenOf: Mock;
  reorder: Mock;
  batch: Mock;
  applyBatch: Mock;
  renderOrder: Mock;
  applyBatchLog: Array<{ ops: Op[]; label: string }>;
}

// Live, mutable root order so the reorder op's `getChildren` reflects the
// effect of each `setChildOrder` → `scene.reorder` write — mirroring how the
// real Scene reorders an in-place sibling list. All test fixtures are flat
// (every node a root, parent null), matching the descriptor's current scope.
function makeScene(rootIds: string[]): SceneMock {
  let order = rootIds.map(asNodeId);
  const reorder = vi.fn((id: NodeId, index: number) => {
    const without = order.filter((x) => x !== id);
    without.splice(index, 0, id);
    order = without;
  });
  const applyBatchLog: Array<{ ops: Op[]; label: string }> = [];

  const scene: SceneMock = {
    get roots() { return order; },
    get: vi.fn((id: NodeId) => ({ id, parent: null })),
    childrenOf: vi.fn().mockReturnValue([]),
    reorder,
    batch: vi.fn((_, fn: () => void) => fn()),
    renderOrder: vi.fn(() => order),
    applyBatch: vi.fn((ops: Op[], label: string, adapter: unknown) => {
      applyBatchLog.push({ ops, label });
      // Mirror scene.applyBatch's fallback: wrap ops in one batch entry and
      // apply each against the supplied commit adapter.
      (scene.batch as (label: string, fn: () => void) => void)(label, () => {
        for (const op of ops) op.apply(adapter);
      });
    }),
    applyBatchLog,
  };
  return scene;
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
// reorderForwardAction (descriptor)
// ---------------------------------------------------------------------------

describe('reorderForwardAction (descriptor)', () => {
  it('has id "reorder.forward"', () => {
    expect(reorderForwardAction.id).toBe('reorder.forward');
  });

  it('label is "Bring Forward"', () => {
    expect(reorderForwardAction.label).toBe('Bring Forward');
  });

  it('declares three parametric defaultBinding entries', () => {
    expect(Array.isArray(reorderForwardAction.defaultBinding)).toBe(true);
    expect((reorderForwardAction.defaultBinding as unknown[]).length).toBe(3);
  });

  it('first binding carries distance: "adjacent" and key Mod+]', () => {
    const bindings = reorderForwardAction.defaultBinding as BoundGesture[];
    const first = bindings[0] as { spec: { kind: string; key: unknown; mods: unknown }; opts: { params: { distance: string } } };
    expect(first.opts.params.distance).toBe('adjacent');
    expect(first.spec.kind).toBe('key');
    // No shifted '}' here: strict mods forbid Shift on this binding, so a
    // character you can only type with Shift could never match it.
    expect(first.spec.key).toEqual([']']);
    expect(first.spec.mods).toEqual({ mod: true });
  });

  it('reaches "extreme" from both Mod+Shift+] and Mod+Alt+]', () => {
    // Mod+Shift+] is the conventional bring-to-front; Mod+Alt+] is the
    // fallback for browsers that reserve Cmd+Shift+] for tab switching.
    // Shifted/Option-produced characters are listed alongside the bracket.
    const bindings = reorderForwardAction.defaultBinding as BoundGesture[];
    const extreme = bindings.slice(1) as Array<{ spec: { kind: string; key: unknown; mods: unknown }; opts: { params: { distance: string } } }>;
    expect(extreme.map((b) => b.opts.params.distance)).toEqual(['extreme', 'extreme']);
    expect(extreme[0].spec.key).toEqual([']', '}']);
    expect(extreme[0].spec.mods).toEqual({ mod: true, shift: true });
    expect(extreme[1].spec.key).toEqual([']', '‘']);
    expect(extreme[1].spec.mods).toEqual({ mod: true, alt: true });
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

    // One batch entry (the applyBatch fallback wraps the op in a single batch).
    expect(scene.batch).toHaveBeenCalledOnce();
    // After bringForward(['a','b','c'], ['b']) → ['a','c','b']. Re-stamping
    // 'c' to index 1 shifts 'b' to index 2 in the live order, so only the
    // single changed slot fires (realistic in-place reorder semantics).
    expect(scene.reorder).toHaveBeenCalledWith(asNodeId('c'), 1);
    expect(scene.reorder).toHaveBeenCalledTimes(1);
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
    // bringToFront(['a','b','c'], ['b']) → ['a','c','b'] — same result for a
    // single item; only the one changed slot re-stamps under live order.
    expect(scene.reorder).toHaveBeenCalledWith(asNodeId('c'), 1);
    expect(scene.reorder).toHaveBeenCalledTimes(1);
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

  it('enabled returns SelectionRequired with no deps / empty selection', () => {
    expect(reorderForwardAction.enabled!()).toBe('selection-required');
    expect(reorderForwardAction.enabled!({ selection: makeSelection([]) } as never)).toBe(
      'selection-required',
    );
  });

  it('enabled returns true when the selection is non-empty', () => {
    expect(reorderForwardAction.enabled!({ selection: makeSelection(['b']) } as never)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// reorderBackwardAction (descriptor)
// ---------------------------------------------------------------------------

describe('reorderBackwardAction (descriptor)', () => {
  it('has id "reorder.backward"', () => {
    expect(reorderBackwardAction.id).toBe('reorder.backward');
  });

  it('label is "Send Backward"', () => {
    expect(reorderBackwardAction.label).toBe('Send Backward');
  });

  it('declares three parametric defaultBinding entries', () => {
    expect(Array.isArray(reorderBackwardAction.defaultBinding)).toBe(true);
    expect((reorderBackwardAction.defaultBinding as unknown[]).length).toBe(3);
  });

  it('first binding carries distance: "adjacent" and key Mod+[', () => {
    const bindings = reorderBackwardAction.defaultBinding as BoundGesture[];
    const first = bindings[0] as { spec: { kind: string; key: unknown; mods: unknown }; opts: { params: { distance: string } } };
    expect(first.opts.params.distance).toBe('adjacent');
    expect(first.spec.kind).toBe('key');
    expect(first.spec.key).toEqual(['[']);
    expect(first.spec.mods).toEqual({ mod: true });
  });

  it('reaches "extreme" from both Mod+Shift+[ and Mod+Alt+[', () => {
    const bindings = reorderBackwardAction.defaultBinding as BoundGesture[];
    const extreme = bindings.slice(1) as Array<{ spec: { kind: string; key: unknown; mods: unknown }; opts: { params: { distance: string } } }>;
    expect(extreme.map((b) => b.opts.params.distance)).toEqual(['extreme', 'extreme']);
    expect(extreme[0].spec.key).toEqual(['[', '{']);
    expect(extreme[0].spec.mods).toEqual({ mod: true, shift: true });
    expect(extreme[1].spec.key).toEqual(['[', '“']);
    expect(extreme[1].spec.mods).toEqual({ mod: true, alt: true });
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
    // sendBackward(['a','b','c'], ['b']) → ['b','a','c']. Moving 'b' to index 0
    // shifts 'a' to index 1 in the live order, so only the one slot fires.
    expect(scene.reorder).toHaveBeenCalledWith(asNodeId('b'), 0);
    expect(scene.reorder).toHaveBeenCalledTimes(1);
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

  it('enabled returns SelectionRequired with no deps / empty selection', () => {
    expect(reorderBackwardAction.enabled!()).toBe('selection-required');
    expect(reorderBackwardAction.enabled!({ selection: makeSelection([]) } as never)).toBe(
      'selection-required',
    );
  });

  it('enabled returns true when the selection is non-empty', () => {
    expect(reorderBackwardAction.enabled!({ selection: makeSelection(['b']) } as never)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Commit routing — consumer applyOps hook vs. scene.applyBatch fallback
// ---------------------------------------------------------------------------

describe('reorder commit routing', () => {
  it('routes through the consumer applyOps hook once with a reorder op + "Reorder" label', () => {
    const scene = makeScene(['a', 'b', 'c']);
    const selection = makeSelection(['b']);
    const applyOps = vi.fn<(ops: Op[], label: string) => void>();

    (reorderForwardAction.invoker as ImmediateInvoker).run(
      { selection, scene, applyOps } as import('../invoker').ActionDeps,
      { distance: 'adjacent' },
    );

    expect(applyOps).toHaveBeenCalledOnce();
    const [ops, label] = applyOps.mock.calls[0];
    expect(label).toBe('Reorder');
    expect(ops).toHaveLength(1);
    // applyOps owns the commit — no direct scene mutation here.
    expect(scene.applyBatch).not.toHaveBeenCalled();
    expect(scene.reorder).not.toHaveBeenCalled();
    expect(scene.batch).not.toHaveBeenCalled();
  });

  it('backward action routes through applyOps with "Reorder" label', () => {
    const scene = makeScene(['a', 'b', 'c']);
    const selection = makeSelection(['b']);
    const applyOps = vi.fn<(ops: Op[], label: string) => void>();

    (reorderBackwardAction.invoker as ImmediateInvoker).run(
      { selection, scene, applyOps } as import('../invoker').ActionDeps,
      { distance: 'adjacent' },
    );

    expect(applyOps).toHaveBeenCalledOnce();
    expect(applyOps.mock.calls[0][1]).toBe('Reorder');
    expect(applyOps.mock.calls[0][0]).toHaveLength(1);
  });

  it('falls back to scene.applyBatch (one batch entry) when no applyOps is present', () => {
    const scene = makeScene(['a', 'b', 'c']);
    const selection = makeSelection(['b']);

    (reorderForwardAction.invoker as ImmediateInvoker).run(
      { selection, scene } as import('../invoker').ActionDeps,
      { distance: 'adjacent' },
    );

    // Exactly one applyBatch call (single undo entry), label "Reorder".
    expect(scene.applyBatch).toHaveBeenCalledOnce();
    expect(scene.applyBatchLog[0].label).toBe('Reorder');
    expect(scene.applyBatchLog[0].ops).toHaveLength(1);
    // Scene reflects the mutation: the op's setChildOrder re-stamped the one
    // changed slot via scene.reorder (live order shifts 'b' to 2 implicitly).
    expect(scene.batch).toHaveBeenCalledOnce();
    expect(scene.reorder).toHaveBeenCalledWith(asNodeId('c'), 1);
    expect(scene.reorder).toHaveBeenCalledTimes(1);
  });

  it('applyOps no-op on empty selection (no commit, no scene writes)', () => {
    const scene = makeScene(['a', 'b', 'c']);
    const selection = makeSelection([]);
    const applyOps = vi.fn<(ops: Op[], label: string) => void>();

    (reorderForwardAction.invoker as ImmediateInvoker).run(
      { selection, scene, applyOps } as import('../invoker').ActionDeps,
      { distance: 'adjacent' },
    );

    expect(applyOps).not.toHaveBeenCalled();
    expect(scene.applyBatch).not.toHaveBeenCalled();
  });
});


// ---------------------------------------------------------------------------
// Default bindings
// ---------------------------------------------------------------------------

/**
 * Modifier matching is strict — an omitted modifier must NOT be held (see
 * `matchModifiers`). That makes a binding's key list and its mod set a single
 * claim: `']'` with `{ mod: true }` cannot fire while Shift is down, and the
 * shifted character `'}'` cannot be produced without Shift. These tests hold
 * the binding table to the shortcuts a user actually presses.
 */
describe('reorder default bindings', () => {
  const keyEvent = (key: string, mods: Partial<ModifiersEvent> = {}): InputEvent => ({
    kind: 'key',
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...mods,
  } as InputEvent);

  /** The distance param a binding carries, or undefined when nothing matches. */
  function distanceFor(action: typeof reorderForwardAction, e: InputEvent): string | undefined {
    const bindings = action.defaultBinding as Array<{
      spec: Parameters<typeof matchSpec>[1];
      opts?: { params?: { distance?: string } };
    }>;
    const hit = bindings.find((b) => matchSpec(e, b.spec, true));
    return hit?.opts?.params?.distance;
  }

  it('sends Cmd+] forward one step', () => {
    expect(distanceFor(reorderForwardAction, keyEvent(']', { metaKey: true }))).toBe('adjacent');
  });

  it('sends Cmd+[ backward one step', () => {
    expect(distanceFor(reorderBackwardAction, keyEvent('[', { metaKey: true }))).toBe('adjacent');
  });

  it('brings to front on Cmd+Shift+] (the shifted key reports as "}")', () => {
    expect(distanceFor(reorderForwardAction, keyEvent('}', { metaKey: true, shiftKey: true })))
      .toBe('extreme');
  });

  it('sends to back on Cmd+Shift+[ (the shifted key reports as "{")', () => {
    expect(distanceFor(reorderBackwardAction, keyEvent('{', { metaKey: true, shiftKey: true })))
      .toBe('extreme');
  });

  it('keeps Cmd+Alt as the extreme fallback for browsers that eat Cmd+Shift', () => {
    expect(distanceFor(reorderForwardAction, keyEvent(']', { metaKey: true, altKey: true })))
      .toBe('extreme');
    expect(distanceFor(reorderBackwardAction, keyEvent('[', { metaKey: true, altKey: true })))
      .toBe('extreme');
  });

  it('leaves an unmodified bracket alone — typing must not reorder', () => {
    expect(distanceFor(reorderForwardAction, keyEvent(']'))).toBeUndefined();
    expect(distanceFor(reorderBackwardAction, keyEvent('['))).toBeUndefined();
  });
});
