/**
 * Undo across targets. Each target's marks live in their own scene, and each
 * scene owns its own undo stack — so "take back the last thing I did" is an
 * ordering question labkit has to answer, not something a single scene knows.
 */
import { describe, expect, it } from 'vitest';
import { createAnnotationStore } from './store';
import type { AnnotationInit, AnnotationTargetInfo } from './types';

const TARGETS: AnnotationTargetInfo[] = [
  { id: 'left', content: { w: 200, h: 100 } },
  { id: 'right', content: { w: 200, h: 100 } },
];

const MARK: Omit<AnnotationInit, 'target'> = {
  kind: 'rect',
  frac: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
};

const store = () => createAnnotationStore({ targets: () => TARGETS });

describe('undo across targets', () => {
  it('takes back the last change wherever it was made', () => {
    const s = store();
    s.add({ ...MARK, target: 'left' });
    s.add({ ...MARK, target: 'right' });
    const third = s.add({ ...MARK, target: 'left' });

    expect(s.undo()).toBe(true);
    expect(s.get(third)).toBeUndefined();
    expect(s.query({ target: 'right' })).toHaveLength(1);

    // Now the most recent surviving change is on the *other* target.
    expect(s.undo()).toBe(true);
    expect(s.query({ target: 'right' })).toHaveLength(0);
    expect(s.query({ target: 'left' })).toHaveLength(1);
  });

  it('redoes in the reverse order, and bottoms out', () => {
    const s = store();
    s.add({ ...MARK, target: 'left' });
    s.add({ ...MARK, target: 'right' });

    expect(s.canUndo()).toBe(true);
    expect(s.canRedo()).toBe(false);
    s.undo();
    s.undo();
    expect(s.canUndo()).toBe(false);
    expect(s.undo()).toBe(false);
    expect(s.query()).toHaveLength(0);

    expect(s.redo()).toBe(true);
    expect(s.query({ target: 'left' })).toHaveLength(1);
    expect(s.redo()).toBe(true);
    expect(s.query({ target: 'right' })).toHaveLength(1);
    expect(s.canRedo()).toBe(false);
  });

  it('drops the redo stack when a new mark lands after an undo', () => {
    const s = store();
    s.add({ ...MARK, target: 'left' });
    s.undo();
    expect(s.canRedo()).toBe(true);
    s.add({ ...MARK, target: 'right' });
    expect(s.canRedo()).toBe(false);
  });

  it('follows an undo driven from inside a pane, not just its own', () => {
    // A pane's own Cmd+Z calls scene.undo() directly. Tracking the ordering
    // off the subscribe callback alone would read that as one more change and
    // append to the undo stack, leaving redo dead.
    const s = store();
    s.add({ ...MARK, target: 'left' });
    s.sceneFor('left').undo();

    expect(s.query()).toHaveLength(0);
    expect(s.canRedo()).toBe(true);
    expect(s.canUndo()).toBe(false);
    expect(s.redo()).toBe(true);
    expect(s.query({ target: 'left' })).toHaveLength(1);
  });
});
