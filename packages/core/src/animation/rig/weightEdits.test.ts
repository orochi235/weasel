import { describe, expect, it } from 'vitest';
import { brushWeights, setWeights } from './weightEdits';

const round = (skin: Record<string, readonly number[]>) =>
  Object.fromEntries(Object.entries(skin).map(([k, v]) => [k, v.map((n) => Math.round(n * 1000) / 1000)]));

describe('setWeights', () => {
  it('sets a joint\'s weight on a point and scales the point\'s other joints to share the rest', () => {
    const skin = { a: [0.5, 1], b: [0.25, 0], c: [0.25, 0] };
    const next = setWeights(skin, 2, 'a', new Map([[0, 0.8]]));
    expect(round(next)).toEqual({ a: [0.8, 1], b: [0.1, 0], c: [0.1, 0] });
    expect(skin.a).toEqual([0.5, 1]);
  });

  it('adds a joint the skin did not weigh, with arrays as long as the path has points', () => {
    const next = setWeights({ a: [1] }, 3, 'b', new Map([[2, 1], [0, 0.25]]));
    expect(round(next)).toEqual({ a: [0.75, 0, 0], b: [0.25, 0, 1] });
  });

  it('gives a point with no other joint wholly to the joint, since weights are normalized as applied', () => {
    expect(setWeights({}, 2, 'a', new Map([[1, 0.3]]))).toEqual({ a: [0, 1] });
  });

  it('drops a joint left weighing nothing', () => {
    expect(setWeights({ a: [1], b: [0] }, 1, 'a', new Map([[0, 0]]))).toEqual({});
    expect(round(setWeights({ a: [0.5], b: [0.5] }, 1, 'a', new Map([[0, 0]])))).toEqual({ b: [1] });
  });

  it('clamps a weight to 0..1', () => {
    expect(round(setWeights({ b: [1] }, 1, 'a', new Map([[0, 7]])))).toEqual({ a: [1] });
  });
});

describe('brushWeights', () => {
  const coords = new Float32Array([0, 0, 5, 0, 10, 0, 30, 0]);

  it('raises points inside the brush toward 1, more the nearer the center, and never lowers one', () => {
    expect([...brushWeights(coords, 0, 0, 10, [0, 0.2, 0, 0], 'add')]).toEqual([[0, 1], [1, 0.5]]);
    expect([...brushWeights(coords, 0, 0, 10, [0, 0.9, 0, 0], 'add')]).toEqual([[0, 1]]);
  });

  it('lowers points toward 0 when removing, and never raises one', () => {
    const hits = brushWeights(coords, 0, 0, 10, [1, 1, 1, 1], 'remove');
    expect([...hits]).toEqual([[0, 0], [1, 0.5]]);
  });

  it('answers only points whose weight changes', () => {
    expect(brushWeights(coords, 100, 100, 10, undefined, 'add').size).toBe(0);
    expect(brushWeights(coords, 0, 0, 10, undefined, 'remove').size).toBe(0);
  });
});
