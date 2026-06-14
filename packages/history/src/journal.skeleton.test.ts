import { describe, it, expect } from 'vitest';
import { createHistory } from './history';

describe('history.beginJournal — Journal skeleton', () => {
  it('beginJournal returns a Journal with the documented surface', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'test', targetId: 'foo' });

    expect(typeof j.applyBatch).toBe('function');
    expect(typeof j.undo).toBe('function');
    expect(typeof j.redo).toBe('function');
    expect(typeof j.canUndo).toBe('function');
    expect(typeof j.canRedo).toBe('function');
    expect(typeof j.entries).toBe('function');
    expect(typeof j.commit).toBe('function');
    expect(typeof j.cancel).toBe('function');
    expect(typeof j.suspend).toBe('function');
    expect(j.targetId).toBe('foo');
    expect(j.forkedAtEntryId).toBeGreaterThanOrEqual(0);
    expect(j.isActive()).toBe(true);
  });

  it('newly-created journal has no undo or redo', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'test' });

    expect(j.canUndo()).toBe(false);
    expect(j.canRedo()).toBe(false);
  });
});
