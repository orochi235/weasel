import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSelectTool } from './useSelectTool';
import { snapToContainer } from '../../../interactions/actions/move/behaviors/snapToContainer';
import type { GestureBinding } from '../../../interactions/actions/binding';

const minimalAdapter = {
  getNode: (id: string) => ({ id }),
  getNodes: () => [],
  getPose: (_id: string) => ({ x: 0, y: 0, width: 10, height: 10 }),
  getParent: (_id: string) => null,
  setPose: vi.fn(),
  setParent: vi.fn(),
  hitTestArea: () => [],
  getSelection: () => [],
  setSelection: vi.fn(),
  applyOps: vi.fn(),
} as any;

describe('useSelectTool move binding behaviors', () => {
  it('threads move.behaviors into the move binding opts', () => {
    const behavior = snapToContainer({ dwellMs: 0, findTarget: () => null });

    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => [],
        move: { behaviors: [behavior] },
      }),
    );

    const moveBinding = (result.current.bindings as GestureBinding[]).find(
      (b) => b.actionId === 'move',
    );
    expect(moveBinding).toBeDefined();
    expect(moveBinding?.opts?.behaviors).toEqual([behavior]);
  });

  it('carries BOTH params.reparentOnDrop AND behaviors when both are set', () => {
    const behavior = snapToContainer({ dwellMs: 0, findTarget: () => null });

    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => [],
        reparentOnDrop: 'top',
        move: { behaviors: [behavior] },
      }),
    );

    const moveBinding = (result.current.bindings as GestureBinding[]).find(
      (b) => b.actionId === 'move',
    );
    expect(moveBinding).toBeDefined();
    expect((moveBinding?.opts?.params as Record<string, unknown>)?.reparentOnDrop).toBe('top');
    expect(moveBinding?.opts?.behaviors).toEqual([behavior]);
  });
});

// The `selectionAllowed` gate (audit 3.4) is gone. It existed because the
// pointerDown classifier was a phase-table route, running on a pipeline where
// `Action.eligible` was never evaluated — so in path-edit mode clicking a
// shape re-selected it (classifier, ungated) while clicking empty canvas did
// nothing (`clearSelection`, correctly gated). The classifier is now
// `select.pick`, which declares the `creates-selection` capability itself;
// `useSelectTool.test.ts` pins that, and the eligibility machinery has its own
// tests in `dispatcher.eligibility.test.ts`.
