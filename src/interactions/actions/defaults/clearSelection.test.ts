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

  it('requires = ["selection"]', () => {
    expect(clearSelectionAction.requires).toEqual(['selection']);
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

  it('has no enabled() guard — dispatcher always admits it (gate is the binding spec)', () => {
    // The click target spec ({ kind: 'click', target: 'empty', mods: {} }) is
    // the real gate. A static enabled() that returns false would break dispatch.
    expect(clearSelectionAction.enabled).toBeUndefined();
  });
});
