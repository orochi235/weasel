import { describe, expect, it } from 'vitest';
import { POSE, makeScene } from './testing/makeScene';

describe('scene.history.dropRedo', () => {
  it('drops the redo stack, keeps the undo stack and the scene, and tells subscribers', () => {
    const s = makeScene();
    const id = s.add({ kind: 'mark', layer: 'structures', pose: POSE, data: { label: 'a' } });
    s.update(id, { data: { label: 'b' } });
    s.undo();
    let notified = 0;
    const off = s.subscribe(() => { notified++; });
    s.history.dropRedo();
    off();
    expect(s.canRedo()).toBe(false);
    expect(s.canUndo()).toBe(true);
    expect(s.get(id)?.data.label).toBe('a');
    expect(notified).toBe(1);
  });
});
