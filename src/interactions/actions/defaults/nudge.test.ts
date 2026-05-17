import { describe, it, expect, vi } from 'vitest';
import {
  defaultNudgeActions,
  nudgeUpAction,
  nudgeDownAction,
  nudgeLeftAction,
  nudgeRightAction,
} from './nudge';
import type { Op } from 'core/ops/types';
import { asNodeId } from 'core/scene/types';
import { ActionDisabledReason } from '../registry';

type Pose = { x: number; y: number; width: number; height: number };

function applyOp(op: Op): { id?: string; pose?: Pose } {
  const captured: { id?: string; pose?: Pose } = {};
  op.apply({ setPose(id: string, pose: Pose) { captured.id = id; captured.pose = pose; } });
  return captured;
}

function makeDeps() {
  return {
    getSelection: () => [asNodeId('a')],
    getPose: (_id: string): Pose => ({ x: 10, y: 10, width: 1, height: 1 }),
    translatePose: (p: Pose, dx: number, dy: number) => ({ ...p, x: p.x + dx, y: p.y + dy }),
    applyOps: vi.fn(),
    step: 1,
    shiftStep: 10,
  };
}

// ---------------------------------------------------------------------------
// Static descriptor tests
// ---------------------------------------------------------------------------

describe('nudgeUpAction (magnitude param)', () => {
  it('has id nudge.up', () => {
    expect(nudgeUpAction.id).toBe('nudge.up');
  });

  it('declares two parametric gestureBindings', () => {
    expect(Array.isArray(nudgeUpAction.gestureBinding)).toBe(true);
    const bindings = nudgeUpAction.gestureBinding as { spec: { kind: string; key: string; mods?: { shift: boolean } }; opts: { params: { magnitude: string } } }[];
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
    const poses: Record<string, Pose> = { a: { x: 10, y: 10, width: 1, height: 1 } };
    const setPose = vi.fn((id: string, pose: Pose) => { poses[id] = pose; });
    const scene = {
      get: (id: string) => ({ pose: poses[id] }),
      batch: (_label: string, fn: () => void) => fn(),
      setPose,
    };
    const selection = { get: () => [asNodeId('a')] };

    nudgeUpAction.invoker!.timing === 'immediate' &&
      (nudgeUpAction.invoker as { run: (deps: unknown, params?: unknown) => void }).run(
        { selection, scene },
        { magnitude: 'small' },
      );

    expect(setPose).toHaveBeenCalledOnce();
    expect(setPose.mock.calls[0][1]).toMatchObject({ x: 10, y: 9 });
  });

  it('invoker.run with magnitude "big" applies BIG_STEP (10) upward', () => {
    const poses: Record<string, Pose> = { a: { x: 10, y: 10, width: 1, height: 1 } };
    const setPose = vi.fn((id: string, pose: Pose) => { poses[id] = pose; });
    const scene = {
      get: (id: string) => ({ pose: poses[id] }),
      batch: (_label: string, fn: () => void) => fn(),
      setPose,
    };
    const selection = { get: () => [asNodeId('a')] };

    (nudgeUpAction.invoker as { run: (deps: unknown, params?: unknown) => void }).run(
      { selection, scene },
      { magnitude: 'big' },
    );

    expect(setPose).toHaveBeenCalledOnce();
    expect(setPose.mock.calls[0][1]).toMatchObject({ x: 10, y: 0 });
  });

  it('invoker.run with no params defaults to small step', () => {
    const poses: Record<string, Pose> = { a: { x: 10, y: 10, width: 1, height: 1 } };
    const setPose = vi.fn((id: string, pose: Pose) => { poses[id] = pose; });
    const scene = {
      get: (id: string) => ({ pose: poses[id] }),
      batch: (_label: string, fn: () => void) => fn(),
      setPose,
    };
    const selection = { get: () => [asNodeId('a')] };

    (nudgeUpAction.invoker as { run: (deps: unknown, params?: unknown) => void }).run(
      { selection, scene },
      undefined,
    );

    expect(setPose).toHaveBeenCalledOnce();
    expect(setPose.mock.calls[0][1]).toMatchObject({ x: 10, y: 9 });
  });

  it('invoker.run is a no-op on empty selection', () => {
    const setPose = vi.fn();
    const scene = {
      get: vi.fn(),
      batch: (_label: string, fn: () => void) => fn(),
      setPose,
    };
    const selection = { get: () => [] };

    (nudgeUpAction.invoker as { run: (deps: unknown, params?: unknown) => void }).run(
      { selection, scene },
      { magnitude: 'small' },
    );

    expect(setPose).not.toHaveBeenCalled();
  });

  it('enabled always returns SelectionRequired', () => {
    expect(nudgeUpAction.enabled!()).toBe(ActionDisabledReason.SelectionRequired);
  });
});

describe('nudgeDownAction descriptor', () => {
  it('has id nudge.down and references ArrowDown', () => {
    expect(nudgeDownAction.id).toBe('nudge.down');
    const bindings = nudgeDownAction.gestureBinding as { spec: { key: string } }[];
    expect(bindings[0].spec.key).toBe('ArrowDown');
  });

  it('invoker.run with magnitude "small" applies +SMALL_STEP downward', () => {
    const poses: Record<string, Pose> = { a: { x: 10, y: 10, width: 1, height: 1 } };
    const setPose = vi.fn((id: string, pose: Pose) => { poses[id] = pose; });
    const scene = {
      get: (id: string) => ({ pose: poses[id] }),
      batch: (_label: string, fn: () => void) => fn(),
      setPose,
    };
    const selection = { get: () => [asNodeId('a')] };

    (nudgeDownAction.invoker as { run: (deps: unknown, params?: unknown) => void }).run(
      { selection, scene },
      { magnitude: 'small' },
    );

    expect(setPose.mock.calls[0][1]).toMatchObject({ x: 10, y: 11 });
  });
});

describe('nudgeLeftAction descriptor', () => {
  it('has id nudge.left and references ArrowLeft', () => {
    expect(nudgeLeftAction.id).toBe('nudge.left');
    const bindings = nudgeLeftAction.gestureBinding as { spec: { key: string } }[];
    expect(bindings[0].spec.key).toBe('ArrowLeft');
  });
});

describe('nudgeRightAction descriptor', () => {
  it('has id nudge.right and references ArrowRight', () => {
    expect(nudgeRightAction.id).toBe('nudge.right');
    const bindings = nudgeRightAction.gestureBinding as { spec: { key: string } }[];
    expect(bindings[0].spec.key).toBe('ArrowRight');
  });

  it('invoker.run with magnitude "big" applies +BIG_STEP rightward', () => {
    const poses: Record<string, Pose> = { a: { x: 10, y: 10, width: 1, height: 1 } };
    const setPose = vi.fn((id: string, pose: Pose) => { poses[id] = pose; });
    const scene = {
      get: (id: string) => ({ pose: poses[id] }),
      batch: (_label: string, fn: () => void) => fn(),
      setPose,
    };
    const selection = { get: () => [asNodeId('a')] };

    (nudgeRightAction.invoker as { run: (deps: unknown, params?: unknown) => void }).run(
      { selection, scene },
      { magnitude: 'big' },
    );

    expect(setPose.mock.calls[0][1]).toMatchObject({ x: 20, y: 10 });
  });
});

// ---------------------------------------------------------------------------
// Legacy bridge tests (existing — preserved)
// ---------------------------------------------------------------------------

describe('defaultNudgeActions', () => {
  it('returns 8 actions with the documented ids', () => {
    const acts = defaultNudgeActions(makeDeps());
    expect(acts.map(a => a.id).sort()).toEqual([
      'nudge.down', 'nudge.down.big',
      'nudge.left', 'nudge.left.big',
      'nudge.right', 'nudge.right.big',
      'nudge.up', 'nudge.up.big',
    ]);
  });

  it('nudge.up binding = ArrowUp, no shift', () => {
    const a = defaultNudgeActions(makeDeps()).find(x => x.id === 'nudge.up')!;
    expect(a.defaultBinding).toEqual({ key: 'ArrowUp' });
    expect(a.gestureBinding).toEqual({ kind: 'key', key: 'ArrowUp' });
  });

  it('nudge.up.big binding = ArrowUp, shift:true', () => {
    const a = defaultNudgeActions(makeDeps()).find(x => x.id === 'nudge.up.big')!;
    expect(a.defaultBinding).toEqual({ key: 'ArrowUp', shift: true });
    expect(a.gestureBinding).toEqual({ kind: 'key', key: 'ArrowUp', mods: { shift: true } });
  });

  it('nudge.left.big binding = ArrowLeft, shift:true', () => {
    const a = defaultNudgeActions(makeDeps()).find(x => x.id === 'nudge.left.big')!;
    expect(a.defaultBinding).toEqual({ key: 'ArrowLeft', shift: true });
    expect(a.gestureBinding).toEqual({ kind: 'key', key: 'ArrowLeft', mods: { shift: true } });
  });

  it('label is "Nudge <Direction>" / "Nudge <Direction> (Big)"', () => {
    const acts = defaultNudgeActions(makeDeps());
    expect(acts.find(a => a.id === 'nudge.up')!.label).toBe('Nudge Up');
    expect(acts.find(a => a.id === 'nudge.up.big')!.label).toBe('Nudge Up (Big)');
  });

  it('run() of nudge.up applies dy=-step', () => {
    const deps = makeDeps();
    const a = defaultNudgeActions(deps).find(x => x.id === 'nudge.up')!;
    a.run!();
    const ops = deps.applyOps.mock.calls[0][0];
    expect(applyOp(ops[0]).pose).toMatchObject({ x: 10, y: 9 });
  });

  it('run() of nudge.up.big applies dy=-shiftStep', () => {
    const deps = makeDeps();
    const a = defaultNudgeActions(deps).find(x => x.id === 'nudge.up.big')!;
    a.run!();
    const ops = deps.applyOps.mock.calls[0][0];
    expect(applyOp(ops[0]).pose).toMatchObject({ x: 10, y: 0 });
  });

  it('run() of nudge.right applies dx=+step', () => {
    const deps = makeDeps();
    const a = defaultNudgeActions(deps).find(x => x.id === 'nudge.right')!;
    a.run!();
    const ops = deps.applyOps.mock.calls[0][0];
    expect(applyOp(ops[0]).pose).toMatchObject({ x: 11, y: 10 });
  });

  it('run() is a no-op on empty selection', () => {
    const deps = { ...makeDeps(), getSelection: () => [] };
    const a = defaultNudgeActions(deps).find(x => x.id === 'nudge.up')!;
    a.run!();
    expect(deps.applyOps).not.toHaveBeenCalled();
  });

  it('default step=1, shiftStep=10 when not provided', () => {
    const deps = {
      getSelection: () => [asNodeId('a')],
      getPose: () => ({ x: 0, y: 0, width: 1, height: 1 }),
      translatePose: (p: Pose, dx: number, dy: number) => ({ ...p, x: p.x + dx, y: p.y + dy }),
      applyOps: vi.fn(),
    };
    const acts = defaultNudgeActions<Pose>(deps);
    acts.find(a => a.id === 'nudge.right')!.run!();
    expect(applyOp(deps.applyOps.mock.calls[0][0][0]).pose).toMatchObject({ x: 1 });
    deps.applyOps.mockClear();
    acts.find(a => a.id === 'nudge.right.big')!.run!();
    expect(applyOp(deps.applyOps.mock.calls[0][0][0]).pose).toMatchObject({ x: 10 });
  });

  it('all nudge actions have both defaultBinding and gestureBinding', () => {
    const acts = defaultNudgeActions(makeDeps());
    for (const action of acts) {
      expect(action.defaultBinding).toBeDefined();
      expect(action.gestureBinding).toBeDefined();
      // gestureBinding must be a KeySpec with kind='key'
      if (Array.isArray(action.gestureBinding)) {
        expect(action.gestureBinding[0]).toHaveProperty('kind', 'key');
      } else {
        expect(action.gestureBinding).toHaveProperty('kind', 'key');
      }
    }
  });
});
