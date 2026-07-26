import { describe, it, expect, vi } from 'vitest';
import {
  nudgeUpAction,
  nudgeDownAction,
  nudgeLeftAction,
  nudgeRightAction,
} from './nudge';
import { asNodeId } from 'core/scene/types';
import { ActionDisabledReason } from '../registry';

type Pose = { x: number; y: number; width: number; height: number };

// ---------------------------------------------------------------------------
// Stub scene
//
// The commit now emits `createTransformOp`s routed through `commitOps`:
// `applyOps(ops, 'Nudge')` when a consumer hook is present, else
// `scene.applyBatch(ops, 'Nudge', defaultCommitAdapter(scene))`. The stub
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

function runNudge(
  action: typeof nudgeUpAction,
  deps: unknown,
  params?: unknown,
): void {
  (action.invoker as { run: (deps: unknown, params?: unknown) => void }).run(deps, params);
}

// ---------------------------------------------------------------------------
// Static descriptor tests
// ---------------------------------------------------------------------------

describe('nudgeUpAction (magnitude param)', () => {
  it('has id nudge.up', () => {
    expect(nudgeUpAction.id).toBe('nudge.up');
  });

  it('declares two parametric defaultBindings', () => {
    expect(Array.isArray(nudgeUpAction.defaultBinding)).toBe(true);
    const bindings = nudgeUpAction.defaultBinding as { spec: { kind: string; key: string; mods?: { shift: boolean } }; opts: { params: { magnitude: string } } }[];
    expect(bindings).toHaveLength(2);
    expect(bindings[0].opts.params.magnitude).toBe('small');
    expect(bindings[1].opts.params.magnitude).toBe('big');
    // Strict modifier semantics
    expect(bindings[0].spec.mods).toBeUndefined();
    expect(bindings[1].spec.mods).toEqual({ shift: true });
    // Both reference ArrowUp
    expect(bindings[0].spec.key).toBe('ArrowUp');
    expect(bindings[1].spec.key).toBe('ArrowUp');
  });

  it('invoker.run with magnitude "small" applies SMALL_STEP (1) upward', () => {
    const scene = makeStubScene({ a: { x: 10, y: 10, width: 1, height: 1 } });
    const selection = { get: () => [asNodeId('a')] };

    runNudge(nudgeUpAction, { selection, scene }, { magnitude: 'small' });

    expect(scene.poses.get('a')).toMatchObject({ x: 10, y: 9 });
  });

  it('invoker.run with magnitude "big" applies BIG_STEP (10) upward', () => {
    const scene = makeStubScene({ a: { x: 10, y: 10, width: 1, height: 1 } });
    const selection = { get: () => [asNodeId('a')] };

    runNudge(nudgeUpAction, { selection, scene }, { magnitude: 'big' });

    expect(scene.poses.get('a')).toMatchObject({ x: 10, y: 0 });
  });

  it('invoker.run with no params defaults to small step', () => {
    const scene = makeStubScene({ a: { x: 10, y: 10, width: 1, height: 1 } });
    const selection = { get: () => [asNodeId('a')] };

    runNudge(nudgeUpAction, { selection, scene }, undefined);

    expect(scene.poses.get('a')).toMatchObject({ x: 10, y: 9 });
  });

  it('commits exactly one undo entry labeled "Nudge" (no applyOps)', () => {
    const scene = makeStubScene({ a: { x: 10, y: 10, width: 1, height: 1 } });
    const selection = { get: () => [asNodeId('a')] };

    runNudge(nudgeUpAction, { selection, scene }, { magnitude: 'small' });

    expect(scene.batchLog).toHaveLength(1);
    expect(scene.batchLog[0].label).toBe('Nudge');
    expect(scene.batchLog[0].ops).toHaveLength(1);
    expect(scene.batchLog[0].ops[0]).toMatchObject({ id: 'a', pose: { x: 10, y: 9 } });
  });

  it('routes the commit through the consumer applyOps hook when present', () => {
    const scene = makeStubScene({ a: { x: 10, y: 10, width: 1, height: 1 } });
    const selection = { get: () => [asNodeId('a')] };
    const applyOps = vi.fn();

    runNudge(nudgeUpAction, { selection, scene, applyOps }, { magnitude: 'small' });

    // Consumer hook owns the commit — scene.applyBatch is not used.
    expect(applyOps).toHaveBeenCalledOnce();
    expect(scene.batchLog).toHaveLength(0);

    const [ops, label] = applyOps.mock.calls[0] as [Array<{ name: string; args: { id: string; from: Pose; to: Pose } }>, string];
    expect(label).toBe('Nudge');
    expect(ops).toHaveLength(1);
    expect(ops[0].name).toBe('transform');
    expect(ops[0].args.id).toBe('a');
    expect(ops[0].args.from).toMatchObject({ x: 10, y: 10 });
    expect(ops[0].args.to).toMatchObject({ x: 10, y: 9 });
  });

  it('emits one op per selected node, capturing each pre-mutation pose', () => {
    const scene = makeStubScene({
      a: { x: 0, y: 0, width: 1, height: 1 },
      b: { x: 5, y: 5, width: 1, height: 1 },
    });
    const selection = { get: () => [asNodeId('a'), asNodeId('b')] };
    const applyOps = vi.fn();

    runNudge(nudgeRightAction, { selection, scene, applyOps }, { magnitude: 'big' });

    const [ops] = applyOps.mock.calls[0] as [Array<{ args: { id: string; from: Pose; to: Pose } }>];
    expect(ops).toHaveLength(2);
    expect(ops[0].args).toMatchObject({ id: 'a', from: { x: 0 }, to: { x: 10 } });
    expect(ops[1].args).toMatchObject({ id: 'b', from: { x: 5 }, to: { x: 15 } });
  });

  it('invoker.run is a no-op on empty selection', () => {
    const scene = makeStubScene({});
    const applyOps = vi.fn();
    const selection = { get: () => [] };

    runNudge(nudgeUpAction, { selection, scene, applyOps }, { magnitude: 'small' });

    expect(applyOps).not.toHaveBeenCalled();
    expect(scene.batchLog).toHaveLength(0);
  });

  it('enabled always returns SelectionRequired', () => {
    expect(nudgeUpAction.enabled!()).toBe(ActionDisabledReason.SelectionRequired);
  });
});

describe('nudgeDownAction descriptor', () => {
  it('has id nudge.down and references ArrowDown', () => {
    expect(nudgeDownAction.id).toBe('nudge.down');
    const bindings = nudgeDownAction.defaultBinding as { spec: { key: string } }[];
    expect(bindings[0].spec.key).toBe('ArrowDown');
  });

  it('invoker.run with magnitude "small" applies +SMALL_STEP downward', () => {
    const scene = makeStubScene({ a: { x: 10, y: 10, width: 1, height: 1 } });
    const selection = { get: () => [asNodeId('a')] };

    runNudge(nudgeDownAction, { selection, scene }, { magnitude: 'small' });

    expect(scene.poses.get('a')).toMatchObject({ x: 10, y: 11 });
  });
});

describe('nudgeLeftAction descriptor', () => {
  it('has id nudge.left and references ArrowLeft', () => {
    expect(nudgeLeftAction.id).toBe('nudge.left');
    const bindings = nudgeLeftAction.defaultBinding as { spec: { key: string } }[];
    expect(bindings[0].spec.key).toBe('ArrowLeft');
  });
});

describe('nudgeRightAction descriptor', () => {
  it('has id nudge.right and references ArrowRight', () => {
    expect(nudgeRightAction.id).toBe('nudge.right');
    const bindings = nudgeRightAction.defaultBinding as { spec: { key: string } }[];
    expect(bindings[0].spec.key).toBe('ArrowRight');
  });

  it('invoker.run with magnitude "big" applies +BIG_STEP rightward', () => {
    const scene = makeStubScene({ a: { x: 10, y: 10, width: 1, height: 1 } });
    const selection = { get: () => [asNodeId('a')] };

    runNudge(nudgeRightAction, { selection, scene }, { magnitude: 'big' });

    expect(scene.poses.get('a')).toMatchObject({ x: 20, y: 10 });
  });
});
