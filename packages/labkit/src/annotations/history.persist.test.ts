import { describe, expect, it } from 'vitest';
import { MarkHistory, withoutMarkHistory } from './history';
import { annotationsFromJSON, createAnnotationStore } from './store';

const targets = () => [
  { id: 'a', ref: { current: null }, content: { w: 100, h: 100 } },
  { id: 'b', ref: { current: null }, content: { w: 100, h: 100 } },
];
const FRAC = { x: 0.1, y: 0.1, w: 0.2, h: 0.2 };

describe('a mark set saved with its history', () => {
  it('undoes and redoes across its targets in the order the marks were made', () => {
    const first = createAnnotationStore({ targets });
    first.add({ target: 'a', kind: 'rect', frac: FRAC });
    first.add({ target: 'b', kind: 'rect', frac: FRAC });
    first.add({ target: 'a', kind: 'rect', frac: { ...FRAC, x: 0.5 } });
    first.undo();

    const again = annotationsFromJSON(JSON.parse(JSON.stringify(first.toJSON())), targets);
    expect(again.query()).toHaveLength(2);
    again.undo();
    expect(again.query({ target: 'b' })).toHaveLength(0);
    again.undo();
    expect(again.query()).toHaveLength(0);
    again.redo();
    again.redo();
    again.redo();
    expect(again.query({ target: 'a' })).toHaveLength(2);
    expect(again.canRedo()).toBe(false);
  });

  it('opens with nothing to undo where it was saved without one', () => {
    const first = createAnnotationStore({ targets });
    first.add({ target: 'a', kind: 'rect', frac: FRAC });
    const again = annotationsFromJSON(withoutMarkHistory(first.toJSON()), targets);
    expect(again.query()).toHaveLength(1);
    expect(again.canUndo()).toBe(false);
  });

  it('restores an order of a million changes without overflowing the call stack', () => {
    const history = new MarkHistory();
    const undoable = Array.from({ length: 1_000_000 }, (_, stamp) => ({ target: 'a', stamp }));
    history.fromJSON({ undoable, redoable: [] });
    expect(history.toJSON().undoable).toHaveLength(1_000_000);
  });
});
