/** Counterexamples `layout.pbt.test.ts` shrank to, kept as plain examples: each layout moves nothing on a second run. */
import { describe, expect, it } from 'vitest';
import { layered } from './layered';
import type { LayoutFn } from './layout';
import { graphOf, moved, type Box } from './layoutFixture';
import { radial } from './radial';
import { tree } from './tree';

const square: Box = [0, 0, 20, 20];
const stacked = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, k) => [`n${k}`, square]));

function secondRun(layout: LayoutFn, boxes: Record<string, Box>, edges: [string, string][], pins: string[] = []) {
  const first = layout(graphOf(boxes, edges, pins));
  expect(first.size).toBeGreaterThan(0);
  return layout(graphOf(moved(boxes, first), edges, pins));
}

describe('a second run, shrunk', () => {
  it('radial moves nothing after laying out a map stacked at one point', () => {
    const boxes = { ...stacked(6), n1: [0, 0, 20, 30] as Box };
    expect([...secondRun(radial, boxes, [['n4', 'n3'], ['n1', 'n3'], ['n5', 'n4'], ['n5', 'n1']])]).toEqual([]);
  });

  it('layered moves nothing beside two pins it could not both hold', () => {
    expect([...secondRun(layered, stacked(6), [], ['n1', 'n5'])]).toEqual([]);
  });

  it('tree moves nothing beside two pins it could not both hold', () => {
    expect([...secondRun(tree, stacked(6), [], ['n1', 'n5'])]).toEqual([]);
  });
});
