import { describe, expect, it } from 'vitest';
import { makeScene, POSE } from './testing/makeScene';

const at = (x: number) => ({ ...POSE, x });

function setup() {
  const s = makeScene();
  const id = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
  return { s, id, before: s.historyEntries().length };
}

describe('scene.batch coalesceKey', () => {
  it('folds batches carrying one key into one entry, whose undo restores the state before the first', () => {
    const { s, id, before } = setup();
    for (const x of [1, 2, 3]) s.batch('Drag', () => s.setPose(id, at(x)), { coalesceKey: 'drag' });
    s.batch('Drag', () => s.doc.set('k', 3), { coalesceKey: 'drag' });
    expect(s.historyEntries()).toHaveLength(before + 1);
    expect(s.get(id)?.pose).toEqual(at(3));
    s.undo();
    expect(s.get(id)?.pose).toEqual(POSE);
    expect(s.doc.get('k')).toBeUndefined();
    s.redo();
    expect(s.get(id)?.pose).toEqual(at(3));
    expect(s.doc.get('k')).toBe(3);
  });

  it('keeps batches with different keys, or none, apart', () => {
    const { s, id, before } = setup();
    s.batch('Drag', () => s.setPose(id, at(1)), { coalesceKey: 'a' });
    s.batch('Drag', () => s.setPose(id, at(2)), { coalesceKey: 'b' });
    s.batch('Drag', () => s.setPose(id, at(3)));
    s.batch('Drag', () => s.setPose(id, at(4)));
    expect(s.historyEntries()).toHaveLength(before + 4);
  });

  it('starts a new entry after an edit between', () => {
    const { s, id, before } = setup();
    s.batch('Drag', () => s.setPose(id, at(1)), { coalesceKey: 'drag' });
    s.update(id, { data: { label: 'b' } });
    s.batch('Drag', () => s.setPose(id, at(2)), { coalesceKey: 'drag' });
    expect(s.historyEntries()).toHaveLength(before + 3);
    s.undo();
    expect(s.get(id)?.pose).toEqual(at(1));
  });

  it('starts a new entry after an undo, and after the history is sealed', () => {
    const { s, id, before } = setup();
    s.batch('Drag', () => s.setPose(id, at(1)), { coalesceKey: 'drag' });
    s.history.seal();
    s.batch('Drag', () => s.setPose(id, at(2)), { coalesceKey: 'drag' });
    expect(s.historyEntries()).toHaveLength(before + 2);
    s.undo();
    s.batch('Drag', () => s.setPose(id, at(5)), { coalesceKey: 'drag' });
    expect(s.historyEntries()).toHaveLength(before + 2);
    s.undo();
    expect(s.get(id)?.pose).toEqual(at(1));
  });
});
