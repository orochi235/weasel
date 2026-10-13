import { describe, it, expect } from 'vitest';
import { createHistory } from './history';

describe('history.beginJournal — Journal skeleton', () => {
  it('newly-created journal has no undo or redo', () => {
    const adapter = { values: [] as number[] };
    const parent = createHistory(adapter);
    const j = parent.beginJournal({ label: 'test' });

    expect(j.canUndo()).toBe(false);
    expect(j.canRedo()).toBe(false);
  });
});
