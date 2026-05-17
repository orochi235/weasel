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

