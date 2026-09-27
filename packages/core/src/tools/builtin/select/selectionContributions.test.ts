import { describe, it, expect } from 'vitest';
import { matchSorted, type ScopedBinding, type GestureBinding } from '@weasel-js/routing';
import { snapToContainer } from '../../../interactions/actions/move/behaviors/snapToContainer';
import {
  selectionMoveBindings,
  selectionMoveContribution,
  selectionTransformContribution,
  SELECTION_TRANSFORM_BINDINGS,
} from './selectionContributions';

describe('selectionMoveBindings — binding opts', () => {
  it('threads move.behaviors into the move binding opts', () => {
    const behavior = snapToContainer({ dwellMs: 0, findTarget: () => null });
    const moveBinding = selectionMoveBindings({ move: { behaviors: [behavior] } })
      .find((b) => b.actionId === 'move');
    expect(moveBinding?.opts?.behaviors).toEqual([behavior]);
  });

  it('carries BOTH params.reparentOnDrop AND behaviors when both are set', () => {
    const behavior = snapToContainer({ dwellMs: 0, findTarget: () => null });
    const moveBinding = selectionMoveBindings({ reparentOnDrop: 'top', move: { behaviors: [behavior] } })
      .find((b) => b.actionId === 'move');
    expect((moveBinding?.opts?.params as Record<string, unknown>)?.reparentOnDrop).toBe('top');
    expect(moveBinding?.opts?.behaviors).toEqual([behavior]);
  });
});

describe('selection contributions', () => {
  it('are always live and carry only bindings', () => {
    for (const entry of [selectionMoveContribution(), selectionTransformContribution]) {
      expect(entry.eligibility).toEqual({ always: true });
      expect(entry.actions).toBeUndefined();
      expect(entry.bindings?.length).toBeGreaterThan(0);
    }
  });
});

describe('selectionMoveBindings — drag on an unselected body routes to move', () => {
  // Regression: dragging a not-yet-selected object must MOVE it, not rotate.
  //
  // `select.pick` selects the hit node at press time, but the gesture
  // dispatcher bakes the `bodyTarget` BEFORE that selection lands — so the
  // first drag on a fresh object carries `bodyTarget: 'unselected-body'`.
  // With only a `'selected-body'` move binding, that drag fell through to
  // the next ambient drag binding, once a `rotate` catch-all.
  function downEvent(bodyTarget: 'selected-body' | 'unselected-body') {
    return {
      kind: 'pointerdown' as const,
      x: 0, y: 0, clientX: 0, clientY: 0,
      altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
      bodyTarget,
    };
  }

  const ambientCatchAll: ScopedBinding = {
    binding: { spec: { kind: 'drag' }, actionId: 'catchAll' },
    scope: 'ambient',
    ownerToolId: null,
  };

  function moveBindings(): ScopedBinding[] {
    return selectionMoveBindings().map((binding: GestureBinding) => ({
      binding,
      scope: 'ambient' as const,
      ownerToolId: 'selection.move',
    }));
  }

  it('unselected-body drag (no modifiers) wins for move over an untargeted ambient drag', () => {
    const top = matchSorted(downEvent('unselected-body'), [ambientCatchAll, ...moveBindings()], false)[0];
    expect(top?.binding.actionId).toBe('move');
  });

  it('selected-body drag routes to move', () => {
    const top = matchSorted(downEvent('selected-body'), [ambientCatchAll, ...moveBindings()], false)[0];
    expect(top?.binding.actionId).toBe('move');
  });

  it('Alt-drag on either body routes to clone, ahead of move', () => {
    for (const body of ['selected-body', 'unselected-body'] as const) {
      const top = matchSorted({ ...downEvent(body), altKey: true }, moveBindings(), false)[0];
      expect(top?.binding.actionId).toBe('clone');
    }
  });

  // The move binding opts out on anchor / control hits so `editAnchors`'s
  // ambient binding can win. Both sides read `isAnchorOrControl` from
  // `interactions/dispatcher/predicates`, so they cannot drift; these cases
  // pin the boundary that the old hand-rolled `/^(anchor|controlIn|controlOut):/`
  // regex got wrong (it had no trailing-index requirement).
  function downOnAffordance(kind: string) {
    return { ...downEvent('selected-body'), affordance: { kind } };
  }

  it.each(['anchor:0', 'anchor:12', 'controlIn:3', 'controlOut:0'])(
    'move declines a selected-body drag that hit %s',
    (kind) => {
      const top = matchSorted(downOnAffordance(kind), moveBindings(), false)[0];
      expect(top?.binding.actionId).not.toBe('move');
    },
  );

  it.each(['anchor', 'anchorage', 'anchor:', 'anchor:1x', 'controlInner:2'])(
    'move still claims a selected-body drag on the non-anchor kind %s',
    (kind) => {
      const top = matchSorted(downOnAffordance(kind), moveBindings(), false)[0];
      expect(top?.binding.actionId).toBe('move');
    },
  );
});

describe('SELECTION_TRANSFORM_BINDINGS', () => {
  it('binds resize and rotate to their handles only', () => {
    expect(SELECTION_TRANSFORM_BINDINGS.map((b) => b.actionId)).toEqual(['resize', 'rotate']);
    for (const b of SELECTION_TRANSFORM_BINDINGS) {
      expect(typeof (b.spec as { target?: { kindOf?: unknown } }).target?.kindOf).toBe('function');
    }
  });
});
