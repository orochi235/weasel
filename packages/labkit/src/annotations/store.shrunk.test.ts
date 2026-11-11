/** Shrunk counterexamples from `store.pbt.test.ts`, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { annotationsFromJSON, createAnnotationStore } from './store';

const targets = () => [
  { id: '__proto__', content: { w: 50, h: 80 } },
  { id: 'constructor', content: { w: 100, h: 100 } },
];
const FRAC = { x: 0, y: 0, w: 0.0625, h: 0.0625 };

describe('a target named like a key every object inherits', () => {
  it('takes a new mark in a store read back from a save that holds none of its own', () => {
    const saved = createAnnotationStore({ targets }).toJSON();
    const store = annotationsFromJSON(structuredClone(saved), targets);
    for (const target of ['__proto__', 'constructor']) {
      const id = store.add({ target, kind: 'rect', frac: FRAC });
      expect(store.get(id)?.frac).toEqual(FRAC);
    }
  });

  it('keeps its marks and their undo through a save', () => {
    const store = createAnnotationStore({ targets });
    store.add({ target: '__proto__', kind: 'rect', frac: FRAC });
    const again = annotationsFromJSON(JSON.parse(JSON.stringify(store.toJSON())), targets);
    expect(again.query({ target: '__proto__' })).toHaveLength(1);
    expect(again.undo()).toBe(true);
    expect(again.query()).toHaveLength(0);
  });
});
