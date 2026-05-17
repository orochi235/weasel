import { describe, it, expect, vi } from 'vitest';
import { flipAction, defaultFlipActions } from './flip';
import { RECT_POSE_DESCRIPTOR } from '../resize/geometry';
import type { Op } from 'core/ops/types';
import { asNodeId } from 'core/scene/types';
import type { NodeId } from 'core/scene/types';
import type { BoundGesture } from '../registry';

interface Pose { x: number; y: number; width: number; height: number }

function applyOp(op: Op): { id?: string; pose?: Pose } {
  const captured: { id?: string; pose?: Pose } = {};
  op.apply({ setPose(id: string, pose: Pose) { captured.id = id; captured.pose = pose; } });
  return captured;
}

function makeDeps() {
  return {
    getSelection: () => [asNodeId('a')],
    getPose: (_id: string): Pose => ({ x: 10, y: 20, width: 30, height: 40 }),
    geometry: RECT_POSE_DESCRIPTOR as unknown as import('../resize/geometry').PoseDescriptor<Pose>,
    applyOps: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// flipAction descriptor (Phase 4 parametric shape)
// ---------------------------------------------------------------------------

describe('flipAction (axis param)', () => {
  it('has id "flip"', () => {
    expect(flipAction.id).toBe('flip');
  });

  it('declares one action with two parametric gestureBinding entries', () => {
    expect(Array.isArray(flipAction.gestureBinding)).toBe(true);
    expect((flipAction.gestureBinding as unknown[]).length).toBe(2);
  });

  it('first binding carries axis: "x"', () => {
    const bindings = flipAction.gestureBinding as BoundGesture[];
    const first = bindings[0] as { spec: unknown; opts: { params: { axis: string } } };
    expect(first.opts.params.axis).toBe('x');
  });

  it('second binding carries axis: "y"', () => {
    const bindings = flipAction.gestureBinding as BoundGesture[];
    const second = bindings[1] as { spec: unknown; opts: { params: { axis: string } } };
    expect(second.opts.params.axis).toBe('y');
  });

  it('first binding key spec is h/H with shift', () => {
    const bindings = flipAction.gestureBinding as BoundGesture[];
    const first = bindings[0] as { spec: { kind: string; key: unknown; mods: unknown }; opts: unknown };
    expect(first.spec.kind).toBe('key');
    expect(first.spec.key).toEqual(['h', 'H']);
    expect(first.spec.mods).toEqual({ shift: true });
  });

  it('second binding key spec is v/V with shift', () => {
    const bindings = flipAction.gestureBinding as BoundGesture[];
    const second = bindings[1] as { spec: { kind: string; key: unknown; mods: unknown }; opts: unknown };
    expect(second.spec.kind).toBe('key');
    expect(second.spec.key).toEqual(['v', 'V']);
    expect(second.spec.mods).toEqual({ shift: true });
  });

  it('has timing "immediate"', () => {
    expect(flipAction.invoker?.timing).toBe('immediate');
  });

  it('invoker.run with axis: "x" calls scene.setPose for each selected node', () => {
    const pose: Pose = { x: 10, y: 20, width: 30, height: 40 };
    const setPose = vi.fn();
    const selection = {
      get: () => [asNodeId('a')] as NodeId[],
      current: [] as readonly NodeId[],
      set: vi.fn(), add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), clear: vi.fn(),
      contains: vi.fn().mockReturnValue(false),
    };
    const scene = {
      get: vi.fn().mockReturnValue({ pose, id: asNodeId('a'), children: [] }),
      setPose,
      batch: vi.fn((_, fn: () => void) => fn()),
      nodes: new Map(), roots: [], layers: [],
      childrenOf: vi.fn().mockReturnValue([]), ancestorsOf: vi.fn().mockReturnValue([]),
      renderOrder: vi.fn().mockReturnValue([]),
      add: vi.fn(), remove: vi.fn(), update: vi.fn(), setLayer: vi.fn(),
      move: vi.fn(), reorder: vi.fn(), setLayerVisible: vi.fn(), setLayerLocked: vi.fn(),
      registerOp: vi.fn(), recordOp: vi.fn(),
      undo: vi.fn(), redo: vi.fn(), canUndo: vi.fn(), canRedo: vi.fn(),
      toJSON: vi.fn(), subscribe: vi.fn(), subscribeNode: vi.fn(),
    };
    flipAction.invoker!.timing === 'immediate' &&
      (flipAction.invoker as import('../invoker').ImmediateInvoker).run(
        { selection, scene } as import('../invoker').ActionDeps,
        { axis: 'x' },
      );
    expect(scene.batch).toHaveBeenCalledOnce();
    expect(setPose).toHaveBeenCalledOnce();
    // Flipping a rect about its own AABB returns the same canonical pose.
    expect(setPose.mock.calls[0][1]).toEqual(pose);
  });

  it('invoker.run with axis: "y" calls scene.batch with "Flip"', () => {
    const pose: Pose = { x: 10, y: 20, width: 30, height: 40 };
    const batchLabel: string[] = [];
    const scene = {
      get: vi.fn().mockReturnValue({ pose, id: asNodeId('a'), children: [] }),
      setPose: vi.fn(),
      batch: vi.fn((label: string, fn: () => void) => { batchLabel.push(label); fn(); }),
      nodes: new Map(), roots: [], layers: [],
      childrenOf: vi.fn().mockReturnValue([]), ancestorsOf: vi.fn().mockReturnValue([]),
      renderOrder: vi.fn().mockReturnValue([]),
      add: vi.fn(), remove: vi.fn(), update: vi.fn(), setLayer: vi.fn(),
      move: vi.fn(), reorder: vi.fn(), setLayerVisible: vi.fn(), setLayerLocked: vi.fn(),
      registerOp: vi.fn(), recordOp: vi.fn(),
      undo: vi.fn(), redo: vi.fn(), canUndo: vi.fn(), canRedo: vi.fn(),
      toJSON: vi.fn(), subscribe: vi.fn(), subscribeNode: vi.fn(),
    };
    const selection = {
      get: () => [asNodeId('a')] as NodeId[],
      current: [] as readonly NodeId[],
      set: vi.fn(), add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), clear: vi.fn(),
      contains: vi.fn().mockReturnValue(false),
    };
    flipAction.invoker!.timing === 'immediate' &&
      (flipAction.invoker as import('../invoker').ImmediateInvoker).run(
        { selection, scene } as import('../invoker').ActionDeps,
        { axis: 'y' },
      );
    expect(batchLabel).toEqual(['Flip']);
  });

  it('invoker.run with no params defaults to axis: "x"', () => {
    const setPose = vi.fn();
    const scene = {
      get: vi.fn().mockReturnValue({ pose: { x: 0, y: 0, width: 10, height: 10 } }),
      setPose,
      batch: vi.fn((_, fn: () => void) => fn()),
      nodes: new Map(), roots: [], layers: [],
      childrenOf: vi.fn().mockReturnValue([]), ancestorsOf: vi.fn().mockReturnValue([]),
      renderOrder: vi.fn().mockReturnValue([]),
      add: vi.fn(), remove: vi.fn(), update: vi.fn(), setLayer: vi.fn(),
      move: vi.fn(), reorder: vi.fn(), setLayerVisible: vi.fn(), setLayerLocked: vi.fn(),
      registerOp: vi.fn(), recordOp: vi.fn(),
      undo: vi.fn(), redo: vi.fn(), canUndo: vi.fn(), canRedo: vi.fn(),
      toJSON: vi.fn(), subscribe: vi.fn(), subscribeNode: vi.fn(),
    };
    const selection = {
      get: () => [asNodeId('a')] as NodeId[],
      current: [] as readonly NodeId[],
      set: vi.fn(), add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), clear: vi.fn(),
      contains: vi.fn().mockReturnValue(false),
    };
    // Call with undefined params — should not throw and defaults to 'x'.
    flipAction.invoker!.timing === 'immediate' &&
      (flipAction.invoker as import('../invoker').ImmediateInvoker).run(
        { selection, scene } as import('../invoker').ActionDeps,
        undefined,
      );
    expect(scene.batch).toHaveBeenCalledOnce();
    expect(setPose).toHaveBeenCalledOnce();
  });

  it('invoker.run no-ops when selection is empty', () => {
    const scene = {
      get: vi.fn(), setPose: vi.fn(),
      batch: vi.fn((_, fn: () => void) => fn()),
      nodes: new Map(), roots: [], layers: [],
      childrenOf: vi.fn().mockReturnValue([]), ancestorsOf: vi.fn().mockReturnValue([]),
      renderOrder: vi.fn().mockReturnValue([]),
      add: vi.fn(), remove: vi.fn(), update: vi.fn(), setLayer: vi.fn(),
      move: vi.fn(), reorder: vi.fn(), setLayerVisible: vi.fn(), setLayerLocked: vi.fn(),
      registerOp: vi.fn(), recordOp: vi.fn(),
      undo: vi.fn(), redo: vi.fn(), canUndo: vi.fn(), canRedo: vi.fn(),
      toJSON: vi.fn(), subscribe: vi.fn(), subscribeNode: vi.fn(),
    };
    const selection = {
      get: () => [] as NodeId[],
      current: [] as readonly NodeId[],
      set: vi.fn(), add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), clear: vi.fn(),
      contains: vi.fn().mockReturnValue(false),
    };
    flipAction.invoker!.timing === 'immediate' &&
      (flipAction.invoker as import('../invoker').ImmediateInvoker).run(
        { selection, scene } as import('../invoker').ActionDeps,
        { axis: 'x' },
      );
    // batch is never called because the selection guard exits early.
    expect(scene.batch).not.toHaveBeenCalled();
    expect(scene.setPose).not.toHaveBeenCalled();
  });

  it('invoker.run is a no-op when deps are missing (no scene/selection)', () => {
    // Should not throw.
    expect(() => {
      flipAction.invoker!.timing === 'immediate' &&
        (flipAction.invoker as import('../invoker').ImmediateInvoker).run({}, { axis: 'x' });
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// defaultFlipActions legacy bridge
// ---------------------------------------------------------------------------

describe('defaultFlipActions (legacy bridge)', () => {
  it('returns 2 actions with documented ids', () => {
    const acts = defaultFlipActions(makeDeps());
    expect(acts.map(a => a.id).sort()).toEqual(['flip.horizontal', 'flip.vertical']);
  });

  it('flip.horizontal gestureBinding = key(h/H, shift)', () => {
    const a = defaultFlipActions(makeDeps()).find(x => x.id === 'flip.horizontal')!;
    expect(a.gestureBinding).toEqual({ kind: 'key', key: ['h', 'H'], mods: { shift: true } });
  });

  it('flip.vertical gestureBinding = key(v/V, shift)', () => {
    const a = defaultFlipActions(makeDeps()).find(x => x.id === 'flip.vertical')!;
    expect(a.gestureBinding).toEqual({ kind: 'key', key: ['v', 'V'], mods: { shift: true } });
  });

  it('labels are "Flip Horizontal" / "Flip Vertical"', () => {
    const acts = defaultFlipActions(makeDeps());
    expect(acts.find(a => a.id === 'flip.horizontal')!.label).toBe('Flip Horizontal');
    expect(acts.find(a => a.id === 'flip.vertical')!.label).toBe('Flip Vertical');
  });

  it('run() emits one transform op per selected id, label "Flip"', () => {
    const deps = makeDeps();
    defaultFlipActions(deps).find(a => a.id === 'flip.horizontal')!.run!();
    expect(deps.applyOps).toHaveBeenCalledOnce();
    const [ops, label] = deps.applyOps.mock.calls[0];
    expect(label).toBe('Flip');
    expect(ops).toHaveLength(1);
    expect(applyOp(ops[0]).pose).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });

  it('run() is a no-op on empty selection', () => {
    const deps = { ...makeDeps(), getSelection: () => [] };
    defaultFlipActions(deps).find(a => a.id === 'flip.horizontal')!.run!();
    expect(deps.applyOps).not.toHaveBeenCalled();
  });

  it('enabled: SelectionRequired when empty, true when present', () => {
    const empty = { ...makeDeps(), getSelection: () => [] };
    const a1 = defaultFlipActions(empty).find(x => x.id === 'flip.horizontal')!;
    expect(a1.enabled!()).toBe('selection-required');
    const full = makeDeps();
    const a2 = defaultFlipActions(full).find(x => x.id === 'flip.horizontal')!;
    expect(a2.enabled!()).toBe(true);
  });
});
