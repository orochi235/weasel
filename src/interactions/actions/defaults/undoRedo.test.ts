import { describe, it, expect } from 'vitest';
import { undoAction, redoAction, defaultUndoRedoActions } from './undoRedo';

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

const baseDeps = { undo: () => true, redo: () => true };

describe('defaultUndoRedoActions (legacy bridge)', () => {
  it('undo action declares gestureBinding = Mod+Z', () => {
    const actions = defaultUndoRedoActions(baseDeps);
    const undo = actions.find(a => a.id === 'undo')!;
    expect(undo.gestureBinding).toEqual({ kind: 'key', key: 'z', mods: { mod: true } });
  });

  it('redo action declares gestureBinding = Mod+Shift+Z', () => {
    const actions = defaultUndoRedoActions(baseDeps);
    const redo = actions.find(a => a.id === 'redo')!;
    expect(redo.gestureBinding).toEqual({ kind: 'key', key: 'z', mods: { mod: true, shift: true } });
  });

  it('bridge does not expose invoker (legacy run path stays active)', () => {
    const actions = defaultUndoRedoActions(baseDeps);
    expect(actions.find(a => a.id === 'undo')!.invoker).toBeUndefined();
    expect(actions.find(a => a.id === 'redo')!.invoker).toBeUndefined();
  });

  it('undo bridge calls deps.undo()', () => {
    let called = false;
    const actions = defaultUndoRedoActions({ undo: () => { called = true; return true; }, redo: () => true });
    actions.find(a => a.id === 'undo')!.run!();
    expect(called).toBe(true);
  });

  it('redo bridge calls deps.redo()', () => {
    let called = false;
    const actions = defaultUndoRedoActions({ undo: () => true, redo: () => { called = true; return true; } });
    actions.find(a => a.id === 'redo')!.run!();
    expect(called).toBe(true);
  });

  it('enabled not set when canUndo/canRedo not supplied', () => {
    const actions = defaultUndoRedoActions(baseDeps);
    expect(actions.find(a => a.id === 'undo')!.enabled).toBeUndefined();
    expect(actions.find(a => a.id === 'redo')!.enabled).toBeUndefined();
  });

  it('enabled set when canUndo supplied', () => {
    const actions = defaultUndoRedoActions({ ...baseDeps, canUndo: () => true });
    expect(actions.find(a => a.id === 'undo')!.enabled?.()).toBe(true);
  });

  it('enabled returns not-applicable when canUndo returns false', () => {
    const actions = defaultUndoRedoActions({ ...baseDeps, canUndo: () => false });
    expect(actions.find(a => a.id === 'undo')!.enabled?.()).toBe('not-applicable');
  });
});
