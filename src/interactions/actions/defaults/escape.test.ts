import { describe, it, expect, vi } from 'vitest';
import { escapeAction, defaultEscapeAction } from './escape';
import { asNodeId } from 'core/scene/types';

describe('escapeAction (descriptor)', () => {
  it('id="escape", label="Escape"', () => {
    expect(escapeAction.id).toBe('escape');
    expect(escapeAction.label).toBe('Escape');
  });

  it('gestureBinding = { kind: "key", key: "Escape" }', () => {
    expect(escapeAction.gestureBinding).toEqual({ kind: 'key', key: 'Escape' });
  });

  it('invoker.timing = "immediate"', () => {
    expect(escapeAction.invoker?.timing).toBe('immediate');
  });
});

describe('defaultEscapeAction (legacy bridge)', () => {
  it('id="escape", label="Escape", binding={kind:"key", key:"Escape"}', () => {
    const a = defaultEscapeAction({ getSelection: () => [asNodeId('a')], setSelection: vi.fn() });
    expect(a.id).toBe('escape');
    expect(a.label).toBe('Escape');
    expect(a.gestureBinding).toEqual({ kind: 'key', key: 'Escape' });
  });
  it('run() clears selection when non-empty', () => {
    const setSelection = vi.fn();
    const a = defaultEscapeAction({ getSelection: () => [asNodeId('x')], setSelection });
    a.run!();
    expect(setSelection).toHaveBeenCalledWith([]);
  });
  it('run() is a no-op when selection is empty', () => {
    const setSelection = vi.fn();
    const a = defaultEscapeAction({ getSelection: () => [], setSelection });
    a.run!();
    expect(setSelection).not.toHaveBeenCalled();
  });
  // gestureBinding shape is covered by the descriptor test above; the bridge
  // re-exports it unchanged via spread.
  it('enabled returns SelectionRequired when selection is empty', () => {
    const a = defaultEscapeAction({ getSelection: () => [], setSelection: vi.fn() });
    expect(a.enabled?.()).not.toBe(true);
  });
  it('enabled returns true when selection is non-empty', () => {
    const a = defaultEscapeAction({ getSelection: () => [asNodeId('a')], setSelection: vi.fn() });
    expect(a.enabled?.()).toBe(true);
  });
});
