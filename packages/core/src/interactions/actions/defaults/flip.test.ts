import { describe, it, expect, vi } from 'vitest';
import { flipAction } from './flip';
import { asNodeId } from 'core/scene/types';
import type { NodeId } from 'core/scene/types';
import type { BoundGesture } from '../registry';

interface Pose { x: number; y: number; width: number; height: number }

// ---------------------------------------------------------------------------
// Stub scene
//
// The commit now emits `createTransformOp`s routed through a `commitOps`
// helper: `applyOps(ops, 'Flip')` when a consumer hook is present, else
// `scene.applyBatch(ops, 'Flip', defaultCommitAdapter(scene))`. The stub
// mirrors the real scene: `applyBatch` records one undo entry and applies each
// op through the supplied adapter (which writes the op's target pose). The
// adapter the action passes is `defaultCommitAdapter(scene)`, so the stub also
// exposes the read/write methods that adapter calls (`get` / `setPose`).
// ---------------------------------------------------------------------------

interface BatchEntry {
  label: string;
  ops: Array<{ id: string; pose: unknown }>;
}

function makeStubScene(initial: Record<string, Pose>) {
  const poses = new Map<string, Pose>(Object.entries(initial));
  const batchLog: BatchEntry[] = [];
  return {
    poses,
    batchLog,
    renderOrder: () => [...poses.keys()].map((id) => asNodeId(id)),
    get(id: string) {
      if (!poses.has(id as string)) return undefined;
      return { pose: poses.get(id as string) };
    },
    setPose(id: string, pose: Pose) {
      poses.set(id as string, pose);
    },
    applyBatch(opList: unknown[], label: string, adapter: unknown) {
      const recorded: Array<{ id: string; pose: unknown }> = [];
      const a = adapter as { setPose(id: string, pose: unknown): void };
      const wrapped = {
        ...(adapter as object),
        setPose(id: string, pose: unknown) {
          recorded.push({ id, pose });
          a.setPose(id, pose as Pose);
        },
      };
      for (const op of opList as Array<{ apply(x: unknown): void }>) {
        op.apply(wrapped);
      }
      batchLog.push({ label, ops: recorded });
    },
  };
}

function makeSelection(ids: string[]) {
  return {
    get: () => ids.map((id) => asNodeId(id)) as NodeId[],
    current: [] as readonly NodeId[],
    set: vi.fn(), add: vi.fn(), remove: vi.fn(), toggle: vi.fn(), clear: vi.fn(),
    contains: vi.fn().mockReturnValue(false),
  };
}

function runFlip(deps: unknown, params?: unknown): void {
  (flipAction.invoker as import('../invoker').ImmediateInvoker).run(
    deps as import('../invoker').ActionDeps,
    params as Record<string, unknown> | undefined,
  );
}

// ---------------------------------------------------------------------------
// flipAction descriptor (parametric shape)
// ---------------------------------------------------------------------------

describe('flipAction (axis param)', () => {
  it('has id "flip"', () => {
    expect(flipAction.id).toBe('flip');
  });

  it('declares one action with two parametric defaultBinding entries', () => {
    expect(Array.isArray(flipAction.defaultBinding)).toBe(true);
    expect((flipAction.defaultBinding as unknown[]).length).toBe(2);
  });

  it('first binding carries axis: "x"', () => {
    const bindings = flipAction.defaultBinding as BoundGesture[];
    const first = bindings[0] as { spec: unknown; opts: { params: { axis: string } } };
    expect(first.opts.params.axis).toBe('x');
  });

  it('second binding carries axis: "y"', () => {
    const bindings = flipAction.defaultBinding as BoundGesture[];
    const second = bindings[1] as { spec: unknown; opts: { params: { axis: string } } };
    expect(second.opts.params.axis).toBe('y');
  });

  it('first binding key spec is h/H with shift', () => {
    const bindings = flipAction.defaultBinding as BoundGesture[];
    const first = bindings[0] as { spec: { kind: string; key: unknown; mods: unknown }; opts: unknown };
    expect(first.spec.kind).toBe('key');
    expect(first.spec.key).toEqual(['h', 'H']);
    expect(first.spec.mods).toEqual({ shift: true });
  });

  it('second binding key spec is v/V with shift', () => {
    const bindings = flipAction.defaultBinding as BoundGesture[];
    const second = bindings[1] as { spec: { kind: string; key: unknown; mods: unknown }; opts: unknown };
    expect(second.spec.kind).toBe('key');
    expect(second.spec.key).toEqual(['v', 'V']);
    expect(second.spec.mods).toEqual({ shift: true });
  });

  it('has timing "immediate"', () => {
    expect(flipAction.invoker?.timing).toBe('immediate');
  });

  // -------------------------------------------------------------------------
  // Commit semantics (ops-based, routed through commitOps)
  // -------------------------------------------------------------------------

  it('with no applyOps, applies one batch labeled "Flip" to the scene', () => {
    // Asymmetric pose so the flip produces an observable, deterministic change.
    const scene = makeStubScene({ a: { x: 10, y: 20, width: 30, height: 40 } });
    const selection = makeSelection(['a']);

    runFlip({ selection, scene }, { axis: 'x' });

    expect(scene.batchLog).toHaveLength(1);
    expect(scene.batchLog[0].label).toBe('Flip');
    expect(scene.batchLog[0].ops).toHaveLength(1);
    expect(scene.batchLog[0].ops[0].id).toBe('a');
    // Flipping a rect about its own AABB returns the same canonical pose.
    expect(scene.poses.get('a')).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });

  it('routes the commit through the consumer applyOps hook when present', () => {
    const scene = makeStubScene({ a: { x: 10, y: 20, width: 30, height: 40 } });
    const selection = makeSelection(['a']);
    const applyOps = vi.fn();

    runFlip({ selection, scene, applyOps }, { axis: 'x' });

    // Consumer hook owns the commit — scene.applyBatch is not used.
    expect(applyOps).toHaveBeenCalledOnce();
    expect(scene.batchLog).toHaveLength(0);

    const [ops, label] = applyOps.mock.calls[0] as [Array<{ name: string; args: { id: string; from: Pose; to: Pose } }>, string];
    expect(label).toBe('Flip');
    expect(ops).toHaveLength(1);
    expect(ops[0].name).toBe('transform');
    expect(ops[0].args.id).toBe('a');
    // `from` is the pre-flip pose captured before mutation.
    expect(ops[0].args.from).toMatchObject({ x: 10, y: 20, width: 30, height: 40 });
    expect(ops[0].args.to).toMatchObject({ x: 10, y: 20, width: 30, height: 40 });
  });

  it('emits one op per selected node, capturing each pre-mutation pose', () => {
    const scene = makeStubScene({
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 5, y: 5, width: 20, height: 20 },
    });
    const selection = makeSelection(['a', 'b']);
    const applyOps = vi.fn();

    runFlip({ selection, scene, applyOps }, { axis: 'y' });

    const [ops] = applyOps.mock.calls[0] as [Array<{ args: { id: string } }>];
    expect(ops).toHaveLength(2);
    expect(ops[0].args.id).toBe('a');
    expect(ops[1].args.id).toBe('b');
  });

  it('defaults to axis "x" when no params are supplied', () => {
    const scene = makeStubScene({ a: { x: 0, y: 0, width: 10, height: 10 } });
    const selection = makeSelection(['a']);
    const applyOps = vi.fn();

    runFlip({ selection, scene, applyOps }, undefined);

    expect(applyOps).toHaveBeenCalledOnce();
    const [, label] = applyOps.mock.calls[0] as [unknown, string];
    expect(label).toBe('Flip');
  });

  it('invoker.run no-ops when selection is empty', () => {
    const scene = makeStubScene({});
    const selection = makeSelection([]);
    const applyOps = vi.fn();

    runFlip({ selection, scene, applyOps }, { axis: 'x' });

    expect(applyOps).not.toHaveBeenCalled();
    expect(scene.batchLog).toHaveLength(0);
  });

  it('invoker.run is a no-op when deps are missing (no scene/selection)', () => {
    expect(() => {
      runFlip({}, { axis: 'x' });
    }).not.toThrow();
  });
});
