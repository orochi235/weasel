import { describe, it, expect, vi } from 'vitest';
import { defaultEscapeAction } from './escape';
import { asNodeId } from 'core/scene/types';

describe('defaultEscapeAction', () => {
  it('id="escape", label="Escape", binding={key: "Escape"}', () => {
    const a = defaultEscapeAction({ getSelection: () => [asNodeId('a')], setSelection: vi.fn() });
    expect(a.id).toBe('escape');
    expect(a.label).toBe('Escape');
    expect(a.defaultBinding).toEqual({ key: 'Escape' });
  });
  it('run() clears selection when non-empty', () => {
    const setSelection = vi.fn();
    const a = defaultEscapeAction({ getSelection: () => [asNodeId('x')], setSelection });
    a.run();
    expect(setSelection).toHaveBeenCalledWith([]);
  });
  it('run() is a no-op when selection is empty', () => {
    const setSelection = vi.fn();
    const a = defaultEscapeAction({ getSelection: () => [], setSelection });
    a.run();
    expect(setSelection).not.toHaveBeenCalled();
  });
  it('preventDefault stays default-true (no shift required)', () => {
    const a = defaultEscapeAction({ getSelection: () => [], setSelection: vi.fn() });
    expect(a.defaultBinding?.preventDefault).toBeUndefined();
  });
  it('declares gestureBinding mirroring defaultBinding', () => {
    const a = defaultEscapeAction({ getSelection: () => [asNodeId('a')], setSelection: vi.fn() });
    expect(a.gestureBinding).toEqual({ kind: 'key', key: 'Escape' });
  });
});
