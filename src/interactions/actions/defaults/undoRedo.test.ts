import { describe, it, expect } from 'vitest';
import { undoAction, redoAction } from './undoRedo';

describe('undoAction (descriptor)', () => {
  it('id="undo", label="Undo"', () => {
    expect(undoAction.id).toBe('undo');
    expect(undoAction.label).toBe('Undo');
  });

  it('gestureBinding = { kind: "key", key: "z", mods: { mod: true } }', () => {
    expect(undoAction.gestureBinding).toEqual({ kind: 'key', key: 'z', mods: { mod: true } });
  });

  it('invoker.timing = "immediate"', () => {
    expect(undoAction.invoker?.timing).toBe('immediate');
  });
});

describe('redoAction (descriptor)', () => {
  it('id="redo", label="Redo"', () => {
    expect(redoAction.id).toBe('redo');
    expect(redoAction.label).toBe('Redo');
  });

  it('gestureBinding = { kind: "key", key: "z", mods: { mod: true, shift: true } }', () => {
    expect(redoAction.gestureBinding).toEqual({ kind: 'key', key: 'z', mods: { mod: true, shift: true } });
  });

  it('invoker.timing = "immediate"', () => {
    expect(redoAction.invoker?.timing).toBe('immediate');
  });
});
