/** Counterexamples `edges.pbt.test.ts` found, kept as plain cases. */
import { describe, expect, it } from 'vitest';
import { createButton } from './button';
import { createImage } from './image';
import { createRect } from './rect';

describe('widget edges, shrunk', () => {
  it('refuses a NaN size in each factory that checks its size', () => {
    expect(() => createRect({ id: 'r', x: 0, y: 0, w: Number.NaN, h: 10, fill: '#000' })).toThrow();
    expect(() => createImage({ id: 'i', x: 0, y: 0, w: 10, h: Number.NaN, image: {} as ImageBitmap })).toThrow();
    expect(() => createButton({ id: 'b', x: 0, y: 0, w: Number.NaN, h: Number.NaN, label: 'b' })).toThrow();
  });
});
