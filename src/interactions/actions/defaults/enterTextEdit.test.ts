import { describe, it, expect, vi } from 'vitest';
import { enterTextEditAction } from './enterTextEdit';

describe('enterTextEditAction (descriptor)', () => {
  it('id="enterTextEdit", label="Enter text edit"', () => {
    expect(enterTextEditAction.id).toBe('enterTextEdit');
    expect(enterTextEditAction.label).toBe('Enter text edit');
  });

  it('has no defaultBinding or gestureBinding (fires only via Tool.bindings)', () => {
    expect(enterTextEditAction.defaultBinding).toBeUndefined();
    expect(enterTextEditAction.gestureBinding).toBeUndefined();
  });

  it('requires = ["textEdit", "selection"]', () => {
    expect(enterTextEditAction.requires).toEqual(['textEdit', 'selection']);
  });

  it('invoker.timing = "immediate"', () => {
    expect(enterTextEditAction.invoker?.timing).toBe('immediate');
  });

  it('calls startEdit with the single selected id', () => {
    const startEdit = vi.fn();
    const deps = {
      selection: { get: () => ['node-1'], set: vi.fn() },
      textEdit: { startEdit },
    };
    const inv = enterTextEditAction.invoker;
    if (!inv || inv.timing !== 'immediate') throw new Error('expected immediate invoker');
    inv.run(deps as any, undefined);
    expect(startEdit).toHaveBeenCalledOnce();
    expect(startEdit).toHaveBeenCalledWith('node-1');
  });

  it('is a no-op when selection is empty', () => {
    const startEdit = vi.fn();
    const deps = {
      selection: { get: () => [], set: vi.fn() },
      textEdit: { startEdit },
    };
    const inv = enterTextEditAction.invoker;
    if (!inv || inv.timing !== 'immediate') throw new Error('expected immediate invoker');
    inv.run(deps as any, undefined);
    expect(startEdit).not.toHaveBeenCalled();
  });

  it('is a no-op when selection has multiple ids', () => {
    const startEdit = vi.fn();
    const deps = {
      selection: { get: () => ['node-1', 'node-2'], set: vi.fn() },
      textEdit: { startEdit },
    };
    const inv = enterTextEditAction.invoker;
    if (!inv || inv.timing !== 'immediate') throw new Error('expected immediate invoker');
    inv.run(deps as any, undefined);
    expect(startEdit).not.toHaveBeenCalled();
  });

  it('is a no-op when selection dep is absent', () => {
    const startEdit = vi.fn();
    const deps = { textEdit: { startEdit } };
    const inv = enterTextEditAction.invoker;
    if (!inv || inv.timing !== 'immediate') throw new Error('expected immediate invoker');
    expect(() => inv.run(deps as any, undefined)).not.toThrow();
    expect(startEdit).not.toHaveBeenCalled();
  });

  it('is a no-op when textEdit dep is absent', () => {
    const deps = {
      selection: { get: () => ['node-1'], set: vi.fn() },
    };
    const inv = enterTextEditAction.invoker;
    if (!inv || inv.timing !== 'immediate') throw new Error('expected immediate invoker');
    expect(() => inv.run(deps as any, undefined)).not.toThrow();
  });

  describe('isTextNode self-guard', () => {
    it('calls startEdit when isTextNode returns true', () => {
      const startEdit = vi.fn();
      const deps = {
        selection: { get: () => ['node-1'], set: vi.fn() },
        textEdit: { startEdit, isTextNode: () => true },
      };
      const inv = enterTextEditAction.invoker;
      if (!inv || inv.timing !== 'immediate') throw new Error('expected immediate invoker');
      inv.run(deps as any, undefined);
      expect(startEdit).toHaveBeenCalledOnce();
    });

    it('is a no-op when isTextNode returns false (non-text node selected)', () => {
      const startEdit = vi.fn();
      const deps = {
        selection: { get: () => ['rect-1'], set: vi.fn() },
        textEdit: { startEdit, isTextNode: () => false },
      };
      const inv = enterTextEditAction.invoker;
      if (!inv || inv.timing !== 'immediate') throw new Error('expected immediate invoker');
      inv.run(deps as any, undefined);
      expect(startEdit).not.toHaveBeenCalled();
    });

    it('calls startEdit without isTextNode (fires unconditionally when pred absent)', () => {
      const startEdit = vi.fn();
      const deps = {
        selection: { get: () => ['any-node'], set: vi.fn() },
        textEdit: { startEdit }, // no isTextNode
      };
      const inv = enterTextEditAction.invoker;
      if (!inv || inv.timing !== 'immediate') throw new Error('expected immediate invoker');
      inv.run(deps as any, undefined);
      expect(startEdit).toHaveBeenCalledOnce();
    });
  });
});
