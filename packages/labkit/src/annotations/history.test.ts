/**
 * Undo across targets. Each target's marks live in their own scene, and each
 * scene owns its own undo stack — so "take back the last thing I did" is an
 * ordering question labkit has to answer, not something a single scene knows.
 */
import { describe, expect, it } from 'vitest';
import { createMarkStore } from './store';
import type { AnnotationInit, AnnotationTargetInfo } from './types';

const TARGETS: AnnotationTargetInfo[] = [
  { id: 'left', content: { width: 200, height: 100 } },
  { id: 'right', content: { width: 200, height: 100 } },
];

const MARK: Omit<AnnotationInit, 'target'> = {
  kind: 'rect',
  frac: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
};

const store = () => createMarkStore({ targets: () => TARGETS });

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

  it("drops another target's scene redo when a change lands, so its pane cannot redo it", () => {
    const s = store();
    s.add({ ...MARK, target: 'left' });
    s.add({ ...MARK, target: 'right' });
    s.undo();
    s.add({ ...MARK, target: 'left' });

    expect(s.canRedo()).toBe(false);
    expect(s.openScene('right').canRedo()).toBe(false);
    expect(s.openScene('right').redo()).toBe(false);
    expect(s.query({ target: 'right' })).toHaveLength(0);
  });

  it('undoes and redoes updates sharing a coalesce key across targets as one step', () => {
    const s = store();
    const left = s.add({ ...MARK, target: 'left' });
    const right = s.add({ ...MARK, target: 'right' });
    for (const width of [2, 3, 4]) {
      s.update(left, { width }, { coalesceKey: 'restyle:width' });
      s.update(right, { width }, { coalesceKey: 'restyle:width' });
    }
    s.update(left, { title: 'later' });

    s.undo();
    expect(s.get(left)?.title).toBeUndefined();
    s.undo();
    expect(s.get(left)?.width).toBeUndefined();
    expect(s.get(right)?.width).toBeUndefined();
    expect(s.query()).toHaveLength(2);

    s.redo();
    expect(s.get(left)?.width).toBe(4);
    expect(s.get(right)?.width).toBe(4);
  });

  it('keeps a change made after a keyed burst out of its step', () => {
    const s = store();
    const left = s.add({ ...MARK, target: 'left' });
    s.update(left, { width: 3 }, { coalesceKey: 'k' });
    s.add({ ...MARK, target: 'right' });
    s.undo();
    expect(s.query({ target: 'right' })).toHaveLength(0);
    expect(s.get(left)?.width).toBe(3);
  });

  it('takes back a keyed write made after another target changed before that change', () => {
    const s = store();
    const left = s.add({ ...MARK, target: 'left' });
    const right = s.add({ ...MARK, target: 'right' });
    s.update(left, { width: 3 }, { coalesceKey: 'k' });
    s.update(right, { title: 'between' });
    s.update(left, { width: 5 }, { coalesceKey: 'k' });

    s.undo();
    expect(s.get(left)?.width).toBe(3);
    expect(s.get(right)?.title).toBe('between');
  });

  it('follows an undo driven from inside a pane, not just its own', () => {
    // A pane's own Cmd+Z calls scene.undo() directly. Tracking the ordering
    // off the subscribe callback alone would read that as one more change and
    // append to the undo stack, leaving redo dead.
    const s = store();
    s.add({ ...MARK, target: 'left' });
    s.openScene('left').undo();

    expect(s.query()).toHaveLength(0);
    expect(s.canRedo()).toBe(true);
    expect(s.canUndo()).toBe(false);
    expect(s.redo()).toBe(true);
    expect(s.query({ target: 'left' })).toHaveLength(1);
  });

  it("follows a redo driven from inside a pane, keeping another target's redo", () => {
    const s = store();
    s.add({ ...MARK, target: 'left' });
    s.add({ ...MARK, target: 'right' });
    s.undo();
    s.undo();
    s.openScene('left').redo();

    expect(s.query({ target: 'left' })).toHaveLength(1);
    expect(s.canRedo()).toBe(true);
    expect(s.redo()).toBe(true);
    expect(s.query({ target: 'right' })).toHaveLength(1);
    expect(s.canRedo()).toBe(false);
  });

  it('still drops the redo order when a change lands at the depth a redo would reach', () => {
    const s = store();
    s.add({ ...MARK, target: 'left' });
    s.add({ ...MARK, target: 'right' });
    s.undo();
    s.undo();
    s.add({ ...MARK, target: 'left' });
    expect(s.canRedo()).toBe(false);
  });
});
