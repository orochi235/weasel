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
