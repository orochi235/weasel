/**
 * Pilot for the `bezier-edit` demo. Covers:
 *   1. Probe pins the initial S-curve anchor / handle geometry.
 *   2. The "Add point" button extends the path with a new cubic.
 *   3. Dragging a control handle moves the handle, not the anchor —
 *      the canonical edit-anchors gesture.
 *
 * (3) works because `editAnchorsAction.defaultBinding` declares a target
 * predicate matching anchor-kind affordances (`anchor:*`/`controlIn:*`/
 * `controlOut:*`). `matchSorted` orders matches by specificity within
 * scope, so editAnchorsAction's `[1, 0, 0, 1]` binding beats moveAction's
 * bare `[0, 0, 0, 1]` binding on an anchor drag — no opt-outs needed in
 * the general-drag actions. On non-anchor drags the predicate filters the
 * binding out entirely; moveAction wins as before.
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

test('bezier-edit — dragging a vertex translates anchor + both attached handles', async ({ demo }) => {
  await demo.goto('bezier-edit');
  const before = (await demo.probe<HandleEntry[]>('handles'))!;
  const v1 = before[1]; // anchor at (260, 160) with inHandle (220, 60), outHandle (300, 260)
  expect(v1.handleIn).toBeTruthy();
  expect(v1.handleOut).toBeTruthy();

  // Enter edit mode.
  await demo.dblClickScene(v1.anchor);

  // Drag the anchor itself by (40, 20).
  await demo.dragScene({ from: v1.anchor, by: [40, 20] });

  const after = (await demo.probe<HandleEntry[]>('handles'))!;
  const v1After = after[1];

  // Anchor moved by the delta.
  expect(Math.abs(v1After.anchor[0] - (v1.anchor[0] + 40))).toBeLessThanOrEqual(1);
  expect(Math.abs(v1After.anchor[1] - (v1.anchor[1] + 20))).toBeLessThanOrEqual(1);
  // BOTH handles moved by the same delta (translateAnchor keeps them attached).
  expect(Math.abs(v1After.handleIn![0] - (v1.handleIn![0] + 40))).toBeLessThanOrEqual(1);
  expect(Math.abs(v1After.handleIn![1] - (v1.handleIn![1] + 20))).toBeLessThanOrEqual(1);
  expect(Math.abs(v1After.handleOut![0] - (v1.handleOut![0] + 40))).toBeLessThanOrEqual(1);
  expect(Math.abs(v1After.handleOut![1] - (v1.handleOut![1] + 20))).toBeLessThanOrEqual(1);

  // Other anchors are unaffected.
  expect(after[0].anchor).toEqual(before[0].anchor);
  expect(after[0].handleOut).toEqual(before[0].handleOut);
  expect(after[2].anchor).toEqual(before[2].anchor);
  expect(after[2].handleIn).toEqual(before[2].handleIn);
});

test('bezier-edit — dragging a control handle moves the handle, not the anchor', async ({ demo }) => {
  await demo.goto('bezier-edit');

  const before = (await demo.probe<HandleEntry[]>('handles'))!;
  // Vertex 1 has both an inHandle (220,60) and an outHandle (300,260).
  const v1 = before[1];
  expect(v1.handleOut, 'vertex 1 exposes an outHandle to drag').toBeTruthy();
  const startHandle = v1.handleOut!;
  const startAnchor = v1.anchor;

  // Enter path-edit mode by double-clicking the path body — anchor handles
  // are not hit-testable until `editingId` is set.
  await demo.dblClickScene(v1.anchor);

  await demo.dragScene({ from: startHandle, by: [25, -15] });

  const after = (await demo.probe<HandleEntry[]>('handles'))!;
  const v1After = after[1];

  // Handle moved by the gesture delta within 1px (no snap).
  expect(Math.abs(v1After.handleOut![0] - (startHandle[0] + 25))).toBeLessThanOrEqual(1);
  expect(Math.abs(v1After.handleOut![1] - (startHandle[1] - 15))).toBeLessThanOrEqual(1);

  // Anchor did NOT move — the gesture targeted the control, not the vertex.
  expect(v1After.anchor).toEqual(startAnchor);

  // Other anchors and handles are unaffected.
  expect(after[0].anchor).toEqual(before[0].anchor);
  expect(after[0].handleOut).toEqual(before[0].handleOut);
  expect(after[2].anchor).toEqual(before[2].anchor);
  expect(after[2].handleIn).toEqual(before[2].handleIn);
});
