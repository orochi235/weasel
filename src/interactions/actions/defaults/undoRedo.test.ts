import { describe, it, expect } from 'vitest';
import { defaultUndoRedoActions } from './undoRedo';

const baseDeps = { undo: () => true, redo: () => true };

describe('defaultUndoRedoActions', () => {
  it('undo action declares defaultBinding and gestureBinding mirroring each other', () => {
    const actions = defaultUndoRedoActions(baseDeps);
    const undo = actions.find(a => a.id === 'undo')!;
    expect(undo.defaultBinding).toEqual({ key: 'z', mod: true });
    expect(undo.gestureBinding).toEqual({ kind: 'key', key: 'z', mods: { mod: true } });
  });

  it('redo action declares defaultBinding and gestureBinding mirroring each other', () => {
    const actions = defaultUndoRedoActions(baseDeps);
    const redo = actions.find(a => a.id === 'redo')!;
    expect(redo.defaultBinding).toEqual({ key: 'z', mod: true, shift: true });
    expect(redo.gestureBinding).toEqual({ kind: 'key', key: 'z', mods: { mod: true, shift: true } });
  });
});
