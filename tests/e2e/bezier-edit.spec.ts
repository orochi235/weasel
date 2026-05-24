/**
 * Pilot for the `bezier-edit` demo. Pins the initial S-curve geometry as read
 * through the demo's `handles` probe.
 *
 * Note: as of this commit the demo does NOT wire `editAnchorsAction` +
 * `buildAffordanceAt`, so dragging a control handle independently of its
 * anchor is not yet a supported gesture in this demo. The probe is the
 * load-bearing piece — once handle editing is enabled, a follow-up test can
 * use this same probe to assert handle-vs-anchor independence.
 */

import { test, expect } from './fixtures';

type HandleEntry = {
  vertexIndex: number;
  anchor: [number, number];
  handleIn?: [number, number];
  handleOut?: [number, number];
};

test('bezier-edit — handles probe exposes the path anchor model', async ({ demo }) => {
  await demo.goto('bezier-edit');

  const handles = (await demo.probe<HandleEntry[]>('handles'))!;
  expect(handles, 'probe registered and returns an array').toBeTruthy();

  // INITIAL_PATH is M(60,220) → C(140,60, 220,60, 260,160) → C(300,260, 380,260, 420,100)
  // → 3 anchors: (60,220), (260,160), (420,100).
  // Cubic segments give the first anchor an outHandle and the next an inHandle.
  expect(handles.length).toBe(3);

  expect(handles[0].anchor).toEqual([60, 220]);
  expect(handles[0].handleIn).toBeUndefined();
  expect(handles[0].handleOut).toEqual([140, 60]);

  expect(handles[1].anchor).toEqual([260, 160]);
  expect(handles[1].handleIn).toEqual([220, 60]);
  expect(handles[1].handleOut).toEqual([300, 260]);

  expect(handles[2].anchor).toEqual([420, 100]);
  expect(handles[2].handleIn).toEqual([380, 260]);
  expect(handles[2].handleOut).toBeUndefined();
});

test('bezier-edit — Add point extends the path with a new cubic segment', async ({ demo }) => {
  await demo.goto('bezier-edit');

  const before = (await demo.probe<HandleEntry[]>('handles'))!;
  expect(before.length).toBe(3);

  // Click the demo's "Add point" button (DOM-level, no scene coords needed).
  await demo.page.getByRole('button', { name: 'Add point' }).click();

  const after = (await demo.probe<HandleEntry[]>('handles'))!;
  expect(after.length).toBe(4);

  // First three anchors unchanged.
  expect(after.slice(0, 3).map((h) => h.anchor)).toEqual(before.map((h) => h.anchor));

  // New trailing anchor sits 80px to the right of the previous endpoint, and
  // the previously-final anchor gains an outHandle.
  expect(after[2].handleOut).toBeTruthy();
  expect(after[3].anchor[0]).toBe(after[2].anchor[0] + 80);
});
