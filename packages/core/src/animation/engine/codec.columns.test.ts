import { describe, expect, it } from 'vitest';
import { createCodec } from './codec';

const linear = (u: number) => u;

/** Subjects that say which group they are kept with, and under what tag. */
const subject = (group: object, tag: number) => ({ group, tag });
const codec = () => createCodec((on) => on as { group: object; tag: number });

/** A group's columns as `tag: value` pairs, whatever order its lane keeps them in. */
const byTag = (b: ReturnType<typeof createCodec>, group: object): Record<number, number> => {
  const c = b.columns(group)!;
  return Object.fromEntries(Array.from({ length: c.count }, (_, j) => [c.tags[j]!, c.cols[j]!]));
};

describe("a group's columns", () => {
  it('answers null for a group with no voices', () => {
    expect(codec().columns({})).toBeNull();
  });

  it('keeps a group apart from another with as many axes, each subject under its tag', () => {
    const b = codec();
    const g = {};
    const h = {};
    b.tween({ id: 1, on: subject(g, 7), ms: 1000, ease: linear, from: [100], to: [0] });
    b.tween({ id: 2, on: subject(g, 3), ms: 1000, ease: linear, from: [10], to: [0] });
    b.tween({ id: 3, on: subject(h, 7), ms: 1000, ease: linear, from: [-4], to: [0] });
    b.frame(0);
    b.frame(500);
    expect(byTag(b, g)).toEqual({ 7: 50, 3: 5 });
    expect(byTag(b, h)).toEqual({ 7: -2 });
  });

  it('keeps each tag beside its subject as others leave and join', () => {
    const b = codec();
    const g = {};
    for (let tag = 0; tag < 5; tag++) {
      b.tween({ id: tag + 1, on: subject(g, tag), ms: 1000, ease: linear, from: [10 * (tag + 1)], to: [0] });
    }
    b.frame(0);
    b.frame(500);
    // Leaving from the front and the middle moves the last places into the gaps.
    b.stop(1);
    b.stop(3);
    expect(byTag(b, g)).toEqual({ 1: 10, 3: 20, 4: 25 });
    b.tween({ id: 9, on: subject(g, 8), ms: 1000, ease: linear, from: [80], to: [0] });
    b.frame(0);
    expect(byTag(b, g)).toEqual({ 1: 10, 3: 20, 4: 25, 8: 80 });
    b.frame(500);
    expect(byTag(b, g)).toEqual({ 1: 0, 3: 0, 4: 0, 8: 40 });
  });

  it('refuses a subject on other axes than its group', () => {
    const b = codec();
    const g = {};
    b.tween({ id: 1, on: subject(g, 0), ms: 1000, ease: linear, from: [1], to: [0] });
    expect(() => b.tween({ id: 2, on: subject(g, 1), ms: 1000, ease: linear, from: [1, 2], to: [0, 0] })).toThrow(/axes/);
  });
});
