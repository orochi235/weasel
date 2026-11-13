import { describe, expect, it } from 'vitest';
import { annotationsFromJSON, createAnnotationStore } from './store';
import type { AnnotationTargetInfo } from './types';

const TARGETS: AnnotationTargetInfo[] = [{ id: 't', content: { w: 200, h: 100 } }];
const BOX = { x: 0.1, y: 0.1, w: 0.5, h: 0.5 };

describe("a mark's style in the store", () => {
  it('keeps width, color and size through add, update and a save', () => {
    const store = createAnnotationStore({ targets: () => TARGETS });
    const id = store.add({ target: 't', kind: 'rect', frac: BOX, width: 6, color: '#0090ff' });
    expect(store.get(id)).toMatchObject({ width: 6, color: '#0090ff' });
    store.update(id, { width: 10, fontSize: 20 });
    expect(store.get(id)).toMatchObject({ width: 10, color: '#0090ff', fontSize: 20, frac: BOX });
    const back = annotationsFromJSON(store.toJSON(), () => TARGETS);
    expect(back.get(id)).toMatchObject({ width: 10, color: '#0090ff', fontSize: 20 });
  });

  it('takes back a burst of updates sharing a coalesce key in one undo', () => {
    const store = createAnnotationStore({ targets: () => TARGETS });
    const a = store.add({ target: 't', kind: 'rect', frac: BOX, width: 2 });
    const b = store.add({ target: 't', kind: 'ellipse', frac: BOX, width: 3 });
    for (const w of [4, 6, 8]) {
      store.update(a, { width: w }, { coalesceKey: 'restyle:1' });
      store.update(b, { width: w }, { coalesceKey: 'restyle:1' });
    }
    expect(store.undo()).toBe(true);
    expect([store.get(a)?.width, store.get(b)?.width]).toEqual([2, 3]);
  });

  it('paints a restyled mark at its new width', () => {
    const store = createAnnotationStore({ targets: () => TARGETS });
    const id = store.add({
      target: 't',
      kind: 'line',
      frac: BOX,
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.6, y: 0.6 },
      ],
    });
    store.update(id, { width: 9 });
    const [painted] = store.paintedMarks('t');
    expect(painted?.mark.data.width).toBe(9);
  });
});
