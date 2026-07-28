import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSelectTool } from './useSelectTool';
import { ActionDisabledReason } from '../../../interactions/actions/registry';
import type { Action } from '../../../interactions/actions/registry';
import type { ActionDeps } from '../../../interactions/actions/invoker';

type Mods = { alt: boolean; ctrl: boolean; meta: boolean; shift: boolean };
const NO_MODS: Mods = { alt: false, ctrl: false, meta: false, shift: false };

/** A `SelectionApi` stub exposing only what the two select actions touch. */
function selectionStub(current: string[]) {
  const applyClick = vi.fn();
  const set = vi.fn();
  const clear = vi.fn();
  return {
    api: { get: () => current, current, applyClick, set, clear } as never,
    applyClick,
    set,
    clear,
  };
}

function actionOf(tool: { actions?: readonly Action[] }, id: string): Action {
  const action = tool.actions?.find((a) => a.id === id);
  if (!action) throw new Error(`${id} not declared on the tool`);
  return action;
}

/** Fire `select.pick` the way a press dispatch would. */
function press(
  tool: { actions?: readonly Action[] },
  selection: unknown,
  over: { worldX?: number; worldY?: number; mods?: Partial<Mods> } = {},
) {
  const action = actionOf(tool, 'select.pick');
  if (action.invoker?.timing !== 'immediate') throw new Error('expected immediate');
  action.invoker.run({ selection } as unknown as ActionDeps, {
    worldX: over.worldX ?? 50,
    worldY: over.worldY ?? 50,
    mods: { ...NO_MODS, ...over.mods },
  });
}

/** Fire `select.collapseDeferred` the way a click dispatch would, honoring the
 *  `enabled` gate the dispatcher consults first. */
function release(
  tool: { actions?: readonly Action[] },
  selection: unknown,
  mods: Partial<Mods> = {},
): 'ran' | 'declined' {
  const action = actionOf(tool, 'select.collapseDeferred');
  if (action.enabled?.() !== true) return 'declined';
  if (action.invoker?.timing !== 'immediate') throw new Error('expected immediate');
  action.invoker.run({ selection } as unknown as ActionDeps, { mods: { ...NO_MODS, ...mods } });
  return 'ran';
}

const minimalAdapter = {
  // MoveAdapter
  getNode: (id: string) => ({ id }),
  getNodes: () => [],
  getPose: (_id: string) => ({ x: 0, y: 0, width: 10, height: 10 }),
  getParent: (_id: string) => null,
  setPose: vi.fn(),
  setParent: vi.fn(),
  // AreaSelectAdapter
  hitTestArea: () => [],
  getSelection: () => [],
  setSelection: vi.fn(),
  applyOps: vi.fn(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

function mount(options: Record<string, unknown> = {}) {
  const { result } = renderHook(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useSelectTool(minimalAdapter, { pickEvery: () => [], ...options } as any),
  );
  return result.current;
}

describe('useSelectTool', () => {
  it('declares id "select" and an idle cursor', () => {
    const tool = mount();
    expect(tool.id).toBe('select');
    const cursor = tool.cursor;
    expect(typeof cursor === 'function' ? cursor({} as never) : cursor).toBe('default');
  });

  it('declares no phase-table routes', () => {
    const tool = mount();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((tool.def as any)?.initial).toEqual({});
    expect(tool.pointer?.onDown).toBeUndefined();
    expect(tool.pointer?.onClick).toBeUndefined();
  });

  it('press over a body selects it', () => {
    const tool = mount({ pickEvery: () => ['hit-id'] });
    const sel = selectionStub(['hit-id']);
    press(tool, sel.api);
    expect(sel.applyClick).toHaveBeenCalledWith('hit-id', NO_MODS);
  });

  it('press picks the child over its container when both are in pickEvery', () => {
    // Regression: the container's bounds also cover the child, so a press
    // inside the child returns ['F','f1'] (parent first via demo iteration
    // order). Naively taking ids[0] selects the container; with the
    // parent/child collapse the deepest descendant — f1 — wins.
    const parents: Record<string, string | null> = { F: null, f1: 'F' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = { ...minimalAdapter, getParent: (id: string) => parents[id] ?? null } as any;
    const { result } = renderHook(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useSelectTool(adapter, { pickEvery: () => ['F', 'f1'] } as any),
    );
    const sel = selectionStub(['f1']);
    press(result.current, sel.api);
    expect(sel.applyClick).toHaveBeenCalledWith('f1', NO_MODS);
  });

  it('press over empty does NOT clear the selection (that is clearSelection, on release)', () => {
    const tool = mount();
    const sel = selectionStub(['a', 'b']);
    press(tool, sel.api);
    expect(sel.clear).not.toHaveBeenCalled();
    expect(sel.set).not.toHaveBeenCalled();
    expect(sel.applyClick).not.toHaveBeenCalled();
  });

  it('pressing a member of a multi-selection defers the collapse, so a drag moves the whole set', () => {
    const tool = mount({ pickEvery: () => ['a'] });
    const sel = selectionStub(['a', 'b', 'c']);
    press(tool, sel.api);
    expect(sel.applyClick).not.toHaveBeenCalled();
  });

  it('a sub-threshold release after a deferred press collapses to the pressed id', () => {
    const tool = mount({ pickEvery: () => ['a'] });
    const sel = selectionStub(['a', 'b', 'c']);
    press(tool, sel.api);
    expect(release(tool, sel.api)).toBe('ran');
    expect(sel.applyClick).toHaveBeenCalledWith('a', NO_MODS);
  });

  it('collapseDeferred declines when nothing was deferred, so ambient click bindings still win', () => {
    // It is bound with no target at ACTIVE scope, so without this gate it
    // would outrank ambient click bindings (selectAnchor) on every click.
    const tool = mount({ pickEvery: () => ['solo'] });
    const sel = selectionStub(['solo']);
    press(tool, sel.api);            // single selection → nothing deferred
    expect(release(tool, sel.api)).toBe('declined');
    expect(actionOf(tool, 'select.collapseDeferred').enabled?.())
      .toBe(ActionDisabledReason.NotApplicable);
  });

  it('a deferred collapse fires once and then disarms', () => {
    const tool = mount({ pickEvery: () => ['a'] });
    const sel = selectionStub(['a', 'b', 'c']);
    press(tool, sel.api);
    expect(release(tool, sel.api)).toBe('ran');
    expect(release(tool, sel.api)).toBe('declined');
    expect(sel.applyClick).toHaveBeenCalledTimes(1);
  });

  it('pickBest (when supplied) replaces pickEvery + pickTopMostHit', () => {
    const pickBest = vi.fn(() => 'group-1');
    const tool = mount({ pickEvery: () => ['leaf', 'group-1'], pickBest });
    const sel = selectionStub([]);
    press(tool, sel.api);
    expect(pickBest).toHaveBeenCalledWith(50, 50, false, []);
    expect(sel.applyClick).toHaveBeenCalledWith('group-1', NO_MODS);
  });

  it('pickBest returning null means "no body hit" — nothing is selected', () => {
    const tool = mount({ pickEvery: () => ['anything'], pickBest: () => null });
    const sel = selectionStub([]);
    press(tool, sel.api);
    expect(sel.applyClick).not.toHaveBeenCalled();
  });

  it('pickBest receives the alt modifier and the current selection', () => {
    const pickBest = vi.fn(() => 'sub');
    const tool = mount({ pickEvery: () => ['outer', 'sub'], pickBest });
    press(tool, selectionStub(['outer']).api, { mods: { alt: true } });
    expect(pickBest).toHaveBeenCalledWith(50, 50, true, ['outer']);
  });

  it('shift-press forwards the modifier to applyClick and skips the defer', () => {
    // applyClick is the single source of selection mutation: the action hands
    // the modifiers through and applyClick decides add / remove / replace
    // against the host's configured extend key. Shift also short-circuits the
    // deferred-collapse branch, so the change lands on the press.
    const tool = mount({ pickEvery: () => ['a'] });
    const sel = selectionStub(['a', 'b', 'c']);
    press(tool, sel.api, { mods: { shift: true } });
    expect(sel.applyClick).toHaveBeenCalledWith('a', { ...NO_MODS, shift: true });
  });

  it('alt-press falls through to plain selection (clone is alt-DRAG, not alt-click)', () => {
    // Pins the absence of a clone-on-alt-click route, so an accidental future
    // addition gets flagged.
    const tool = mount({ pickEvery: () => ['hit-id'] });
    const sel = selectionStub([]);
    press(tool, sel.api, { mods: { alt: true } });
    expect(sel.applyClick).toHaveBeenCalledWith('hit-id', { ...NO_MODS, alt: true });
  });

  it('extendClickLocked suppresses the selection change on an extend press only', () => {
    // While a path is anchor-edited, a shift-press belongs to the anchor
    // selection. Letting it through would toggle the edited node out of the
    // node selection, which `editAnchors` reads as "the target is gone".
    const tool = mount({ pickEvery: () => ['a'], extendClickLocked: () => true });
    const locked = selectionStub(['a']);
    press(tool, locked.api, { mods: { shift: true } });
    expect(locked.applyClick).not.toHaveBeenCalled();

    // A plain press still re-selects — clicking a different node exits edit
    // mode, which is what you'd expect.
    const plain = selectionStub(['a']);
    press(tool, plain.api);
    expect(plain.applyClick).toHaveBeenCalledWith('a', NO_MODS);
  });

  it('both selection actions carry the creates-selection capability rule', () => {
    // This replaces the `selectionAllowed` option the audit added as an
    // interim patch: eligibility is now the single gate, evaluated the same
    // way for the classifier as for `clearSelection`.
    const tool = mount();
    expect(actionOf(tool, 'select.pick').eligible)
      .toEqual({ capability: 'creates-selection' });
    expect(actionOf(tool, 'select.collapseDeferred').eligible)
      .toEqual({ capability: 'creates-selection' });
  });

  it('does nothing when no selection dep is registered', () => {
    const tool = mount({ pickEvery: () => ['a'] });
    const invoker = actionOf(tool, 'select.pick').invoker;
    if (invoker?.timing !== 'immediate') throw new Error('expected immediate');
    expect(() =>
      invoker.run({} as ActionDeps, { worldX: 0, worldY: 0, mods: NO_MODS }),
    ).not.toThrow();
  });
});

import { matchSorted, type ScopedBinding } from '../../../interactions/dispatcher/matcher';

describe('useSelectTool — press and drag bindings do not collide', () => {
  function pressEvent(bodyTarget: 'selected-body' | 'unselected-body' | 'empty') {
    return {
      kind: 'pointerdown' as const,
      stage: 'press' as const,
      x: 0, y: 0, clientX: 0, clientY: 0,
      altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
      bodyTarget,
    };
  }

  function selectBindings(): ScopedBinding[] {
    const tool = mount({ pickEvery: () => ['hit-id'] });
    return (tool.bindings ?? []).map((binding) => ({
      binding,
      scope: 'active' as const,
      ownerToolId: 'select',
    }));
  }

  it.each(['selected-body', 'unselected-body', 'empty'] as const)(
    'the eager press on %s matches select.pick and no drag binding',
    (body) => {
      const matches = matchSorted(pressEvent(body), selectBindings(), false);
      expect(matches.map((m) => m.binding.actionId)).toEqual(['select.pick']);
    },
  );

  it('a modified press still reaches select.pick', () => {
    for (const mod of ['shiftKey', 'metaKey', 'altKey', 'ctrlKey'] as const) {
      const ev = { ...pressEvent('unselected-body'), [mod]: true };
      const matches = matchSorted(ev, selectBindings(), false);
      expect(matches.map((m) => m.binding.actionId)).toEqual(['select.pick']);
    }
  });
});

describe('useSelectTool — drag on an unselected body routes to move', () => {
  // Regression: dragging a not-yet-selected object must MOVE it, not rotate.
  //
  // `select.pick` selects the hit node at press time, but the gesture
  // dispatcher bakes the `bodyTarget` BEFORE that selection lands — so the
  // first drag on a fresh object carries `bodyTarget: 'unselected-body'`.
  // With only a `'selected-body'` move binding, that drag found no ACTIVE
  // match and fell through to the ambient `rotate` catch-all (`{ kind:
  // 'drag' }`, whose `start()` only guards on a non-empty selection — which
  // the classifier has by then established). Result: first drag rotated,
  // subsequent drags (now pre-selected) moved.
  function downEvent(bodyTarget: 'selected-body' | 'unselected-body') {
    return {
      kind: 'pointerdown' as const,
      x: 0, y: 0, clientX: 0, clientY: 0,
      altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
      bodyTarget,
    };
  }

  // The ambient rotate catch-all that hijacked the first drag pre-fix.
  const ambientRotate: ScopedBinding = {
    binding: { spec: { kind: 'drag' }, actionId: 'rotate' },
    scope: 'ambient',
    ownerToolId: null,
  };

  function selectBindings(): ScopedBinding[] {
    const tool = mount({ pickEvery: () => ['hit-id'] });
    return (tool.bindings ?? []).map((binding) => ({
      binding,
      scope: 'active' as const,
      ownerToolId: 'select',
    }));
  }

  it('unselected-body drag (no modifiers) wins for move over the ambient rotate catch-all', () => {
    const bindings = [...selectBindings(), ambientRotate];
    const top = matchSorted(downEvent('unselected-body'), bindings, false)[0];
    expect(top?.binding.actionId).toBe('move');
    expect(top?.scope).toBe('active');
  });

  it('selected-body drag still routes to move (unchanged)', () => {
    const bindings = [...selectBindings(), ambientRotate];
    const top = matchSorted(downEvent('selected-body'), bindings, false)[0];
    expect(top?.binding.actionId).toBe('move');
    expect(top?.scope).toBe('active');
  });

  // The move binding opts out on anchor / control hits so `editAnchors`'s
  // ambient binding can win. Both sides now read `isAnchorOrControl` from
  // `interactions/dispatcher/predicates`, so they cannot drift; these cases
  // pin the boundary that the old hand-rolled `/^(anchor|controlIn|controlOut):/`
  // regex got wrong (it had no trailing-index requirement).
  function downOnAffordance(kind: string) {
    return { ...downEvent('selected-body'), affordance: { kind } };
  }

  it.each(['anchor:0', 'anchor:12', 'controlIn:3', 'controlOut:0'])(
    'move declines a selected-body drag that hit %s',
    (kind) => {
      const top = matchSorted(downOnAffordance(kind), selectBindings(), false)[0];
      expect(top?.binding.actionId).not.toBe('move');
    },
  );

  it.each(['anchor', 'anchorage', 'anchor:', 'anchor:1x', 'controlInner:2'])(
    'move still claims a selected-body drag on the non-anchor kind %s',
    (kind) => {
      const top = matchSorted(downOnAffordance(kind), selectBindings(), false)[0];
      expect(top?.binding.actionId).toBe('move');
    },
  );
});

// useSelectTool no longer publishes its own overlay layer. Marquee paint moved
// to the dispatcher overlay layer (`useDispatcherOverlayLayer`); move ghosts
// moved to the preview-ghost layer (`usePreviewGhostLayer`).
