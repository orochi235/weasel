/**
 * Tests for `deleteAction` descriptor.
 */
import { describe, it, expect, vi } from 'vitest';
import { deleteAction } from './delete';
import type { ImmediateInvoker } from '../invoker';
import type { NodeId } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { Op } from 'core/ops/types';

// ---------------------------------------------------------------------------
// Stub scene — tracks removals, roots/children for index capture, and an
// `applyBatch` fallback so we can assert the non-`applyOps` commit path.
// ---------------------------------------------------------------------------

interface StubNode {
  id: NodeId;
  kind: 'leaf' | 'container';
  layer: string;
  pose: unknown;
  data: unknown;
  parent: NodeId | null;
}

function makeStubScene(
  initial: Record<string, { parent?: string | null; kind?: 'leaf' | 'container' }> = {},
  rootOrder?: string[],
) {
  const nodes = new Map<string, StubNode>();
  for (const [id, v] of Object.entries(initial)) {
    nodes.set(id, {
      id: asNodeId(id),
      kind: v.kind ?? 'leaf',
      layer: 'main',
      pose: { x: 0, y: 0, width: 10, height: 10 },
      data: {},
      parent: v.parent != null ? asNodeId(v.parent) : null,
    });
  }
  const removed: string[] = [];
  const batchLog: Array<{ label: string }> = [];
  const applyBatchLog: Array<{ ops: Op[]; label: string }> = [];

  const roots = (): NodeId[] =>
    (rootOrder ?? [...nodes.keys()].filter((id) => nodes.get(id)!.parent == null)).map(asNodeId);

  const scene = {
    get: (id: NodeId) => nodes.get(id),
    childrenOf: (id: NodeId) =>
      [...nodes.values()].filter((n) => n.parent === id).map((n) => n.id),
    get roots() { return roots(); },
    remove: vi.fn((id: NodeId) => {
      if (!nodes.has(id)) throw new Error(`no node ${id}`);
      removed.push(id);
      nodes.delete(id);
    }),
    add: vi.fn(),
    batch: vi.fn(<T>(label: string, fn: () => T): T => {
      batchLog.push({ label });
      return fn();
    }),
    applyBatch: vi.fn((ops: Op[], label: string, adapter: unknown) => {
      applyBatchLog.push({ ops, label });
      for (const op of ops) op.apply(adapter);
    }),
  };
  return { scene, nodes, removed, batchLog, applyBatchLog };
}

function makeSelection(ids: string[]) {
  return {
    get: () => ids.map(asNodeId),
    set: vi.fn(),
  };
}

function runDelete(deps: Record<string, unknown>) {
  (deleteAction.invoker as ImmediateInvoker).run(deps as Parameters<ImmediateInvoker['run']>[0]);
}

describe('deleteAction (descriptor)', () => {
  it('id="delete", label="Delete"', () => {
    expect(deleteAction.id).toBe('delete');
    expect(deleteAction.label).toBe('Delete');
  });

  it('defaultBinding = Delete/Backspace, gated to [*:initial]', () => {
    expect(deleteAction.defaultBinding).toEqual({
      kind: 'key',
      key: ['Delete', 'Backspace'],
      phase: [{ channel: '*', phase: 'initial' }],
    });
  });

  it('invoker.timing = "immediate"', () => {
    expect(deleteAction.invoker?.timing).toBe('immediate');
  });
});

describe('deleteAction commit routing', () => {
  it('routes through the consumer applyOps hook once with delete ops + "Delete" label', () => {
    const { scene } = makeStubScene({ a: {}, b: {} });
    const selection = makeSelection(['a', 'b']);
    const applyOps = vi.fn<(ops: Op[], label: string) => void>();

    runDelete({ selection, scene, applyOps });

    expect(applyOps).toHaveBeenCalledOnce();
    const [ops, label] = applyOps.mock.calls[0];
    expect(label).toBe('Delete');
    expect(ops).toHaveLength(2);
    for (const op of ops) expect(op.name).toBe('delete');
    expect((ops[0].args as { node: { id: string } }).node.id).toBe('a');
    expect((ops[1].args as { node: { id: string } }).node.id).toBe('b');
    // applyOps owns the commit — no direct scene mutation here.
    expect(scene.remove).not.toHaveBeenCalled();
    // Selection cleared after delete.
    expect(selection.set).toHaveBeenCalledWith([]);
  });

  it('captures each node\'s host-array index in its delete op', () => {
    // a, b at root; c is a child of b.
    const { scene } = makeStubScene(
      { a: {}, b: {}, c: { parent: 'b' } },
      ['a', 'b'],
    );
    const selection = makeSelection(['c', 'a']);
    const applyOps = vi.fn<(ops: Op[], label: string) => void>();

    runDelete({ selection, scene, applyOps });

    const [ops] = applyOps.mock.calls[0];
    // c is index 0 among b's children; a is index 0 among roots.
    const byId = new Map(ops.map((o) => [(o.args as { node: { id: string } }).node.id, o.args as { index: number }]));
    expect(byId.get('c')!.index).toBe(0);
    expect(byId.get('a')!.index).toBe(0);
  });

  it('falls back to scene.applyBatch (one batch entry) when no applyOps is present', () => {
    const { scene, nodes, applyBatchLog } = makeStubScene({ a: {}, b: {} });
    const selection = makeSelection(['a', 'b']);

    runDelete({ selection, scene });

    // Exactly one applyBatch call (single undo entry), label "Delete".
    expect(scene.applyBatch).toHaveBeenCalledOnce();
    expect(applyBatchLog[0].label).toBe('Delete');
    // Scene reflects the mutation: both nodes removed via the adapter.
    expect(scene.remove).toHaveBeenCalledTimes(2);
    expect(nodes.has('a')).toBe(false);
    expect(nodes.has('b')).toBe(false);
    expect(selection.set).toHaveBeenCalledWith([]);
  });

  it('no-ops on empty selection', () => {
    const { scene } = makeStubScene({ a: {} });
    const selection = makeSelection([]);
    const applyOps = vi.fn<(ops: Op[], label: string) => void>();

    runDelete({ selection, scene, applyOps });

    expect(applyOps).not.toHaveBeenCalled();
    expect(scene.applyBatch).not.toHaveBeenCalled();
    expect(selection.set).not.toHaveBeenCalled();
  });
});
