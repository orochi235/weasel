/**
 * Anchor gestures on the `path-anchor-edit` demo's `wave` node,
 * `M280 200 C300 60 400 60 420 200 Z`. Its coords hold four points: anchor 0,
 * anchor 0's out-handle, anchor 1's in-handle, anchor 1.
 *
 * An edit re-stores the path relative to its new bounds, so the assertions
 * compare points with each other rather than with world positions.
 */

import { test, expect, type Demo } from './fixtures';

type Point = [number, number];

async function waveCoords(demo: Demo): Promise<number[]> {
  return demo.page.evaluate(() => {
    const scene = window.__weaselTest!.getScene() as {
      nodes: { id: string; data: { path: { coords: object } } }[];
    };
    return Object.values(scene.nodes.find((n) => n.id === 'wave')!.data.path.coords) as number[];
  });
}

function offset(coords: number[], from: number, to: number): Point {
  return [coords[2 * to] - coords[2 * from], coords[2 * to + 1] - coords[2 * from + 1]];
}

function expectNear(actual: Point, expected: Point) {
  expect(Math.abs(actual[0] - expected[0])).toBeLessThanOrEqual(1);
  expect(Math.abs(actual[1] - expected[1])).toBeLessThanOrEqual(1);
}

async function enterEdit(demo: Demo) {
  await demo.goto('path-anchor-edit');
  await demo.dblClickScene([350, 150]);
}

test('path-anchor-edit — dragging an anchor carries its handle with it', async ({ demo }) => {
  await enterEdit(demo);
  const before = await waveCoords(demo);

  await demo.dragScene({ from: [420, 200], by: [20, 20] });

  const after = await waveCoords(demo);
  const [dx, dy] = offset(before, 0, 3);
  expectNear(offset(after, 0, 3), [dx + 20, dy + 20]);
  expectNear(offset(after, 3, 2), offset(before, 3, 2));
  expectNear(offset(after, 0, 1), offset(before, 0, 1));
});

test('path-anchor-edit — dragging a control handle leaves the anchors put', async ({ demo }) => {
  await enterEdit(demo);
  const before = await waveCoords(demo);

  await demo.dragScene({ from: [300, 60], by: [25, -15] });

  const after = await waveCoords(demo);
  const [dx, dy] = offset(before, 0, 1);
  expectNear(offset(after, 0, 1), [dx + 25, dy - 15]);
  expectNear(offset(after, 0, 3), offset(before, 0, 3));
  expectNear(offset(after, 3, 2), offset(before, 3, 2));
});

test('path-anchor-edit — alt-click on the curve inserts an anchor', async ({ demo }) => {
  await enterEdit(demo);
  const before = await waveCoords(demo);
  expect(before.length).toBe(8);

  // (350, 95) is the cubic's midpoint.
  const [cx, cy] = await demo.sceneToCss([350, 95]);
  await demo.page.keyboard.down('Alt');
  await demo.page.mouse.click(cx, cy);
  await demo.page.keyboard.up('Alt');

  const after = await waveCoords(demo);
  // One cubic split in two: six more coords.
  expect(after.length).toBe(14);
  expectNear(offset(after, 0, 6), offset(before, 0, 3));
});
