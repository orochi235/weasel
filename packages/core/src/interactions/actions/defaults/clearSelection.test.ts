import { describe, it, expect, vi } from 'vitest';
import { clearSelectionAction } from './clearSelection';

describe('clearSelectionAction (descriptor)', () => {
  it('id="clearSelection", label="Clear selection"', () => {
    expect(clearSelectionAction.id).toBe('clearSelection');
    expect(clearSelectionAction.label).toBe('Clear selection');
  });

  it('has no defaultBinding or defaultBinding (fires only via Tool.bindings)', () => {
    expect(clearSelectionAction.defaultBinding).toBeUndefined();
    expect(clearSelectionAction.defaultBinding).toBeUndefined();
  });

  it('requires selection, plus editAnchors for the enabled gate', () => {
    expect(clearSelectionAction.requires).toEqual(['selection', 'editAnchors']);
  });

  it('invoker.timing = "immediate"', () => {
    expect(clearSelectionAction.invoker?.timing).toBe('immediate');
  });

  it('invoker.run calls selection.set([])', () => {
    const set = vi.fn();
    const deps = { selection: { set, get: () => ['a', 'b'] } };
    const inv = clearSelectionAction.invoker;
    if (!inv || inv.timing !== 'immediate') throw new Error('expected immediate invoker');
    inv.run(deps as any, undefined);
    expect(set).toHaveBeenCalledWith([]);
  });

  it('invoker.run is a no-op when selection dep is absent', () => {
    // Should not throw when the dep is missing.
    const inv = clearSelectionAction.invoker;
    if (!inv || inv.timing !== 'immediate') throw new Error('expected immediate invoker');
    expect(() => inv.run({} as any, undefined)).not.toThrow();
  });

  it('enabled() admits the click by default — the binding spec is the real gate', () => {
    // The click target spec ({ kind: 'click', target: 'empty', mods: {} }) is
    // what decides where this fires. There is deliberately no "is anything
    // selected?" guard; clearing an empty selection is a safe no-op.
    expect(clearSelectionAction.enabled?.({} as any)).toBe(true);
    expect(clearSelectionAction.enabled?.(undefined as any)).toBe(true);
  });

  it('enabled() declines while a path is in anchor-edit mode', () => {
    // Falls through to selectAnchorAction. See anchorEditing.test.ts for the
    // handoff, and clearSelection.ts for why eligibility alone is not enough.
    const deps = { editAnchors: { editingId: 'p1' } };
    expect(clearSelectionAction.enabled?.(deps as any)).not.toBe(true);
    const idle = { editAnchors: { editingId: '' } };
    expect(clearSelectionAction.enabled?.(idle as any)).toBe(true);
  });
});
