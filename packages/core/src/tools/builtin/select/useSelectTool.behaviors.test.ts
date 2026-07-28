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

describe('useSelectTool — selectionAllowed gate (audit 3.4)', () => {
  // The pointerDown classifier is a phase-table route, so it runs on the tool
  // pipeline where `Action.eligible` is never evaluated. In path-edit mode
  // that meant clicking a shape re-selected it (classifier, ungated) while
  // clicking empty canvas did nothing (`clearSelection`, correctly gated) —
  // one tool, opposite gating, decided by which dispatcher owned the route.
  function classify(selectionAllowed: (() => boolean) | undefined, applyClick: () => void) {
    const { result } = renderHook(() =>
      useSelectTool(minimalAdapter, {
        pickEvery: () => ['n1'],
        ...(selectionAllowed ? { selectionAllowed } : {}),
      }),
    );
    const ctx = {
      worldX: 0, worldY: 0,
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      selection: { current: [] as string[], get: () => [], applyClick },
      scratch: null,
    };
    const route = (result.current.def as {
      initial?: { pointerDown?: Record<string, (c: unknown) => unknown> };
    }).initial?.pointerDown?.['*'];
    expect(route).toBeDefined();
    route!(ctx as never);
  }

  it('does not mutate the selection when selection is disallowed', () => {
    const applyClick = vi.fn();
    classify(() => false, applyClick);
    expect(applyClick).not.toHaveBeenCalled();
  });

  it('mutates the selection when allowed', () => {
    const applyClick = vi.fn();
    classify(() => true, applyClick);
    expect(applyClick).toHaveBeenCalledTimes(1);
  });

  it('defaults to allowed when no gate is supplied', () => {
    const applyClick = vi.fn();
    classify(undefined, applyClick);
    expect(applyClick).toHaveBeenCalledTimes(1);
  });
});
