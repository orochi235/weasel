/**
 * Pilot for the `bezier-edit` demo. Covers:
 *   1. Probe pins the initial S-curve anchor / handle geometry.
 *   2. The "Add point" button extends the path with a new cubic.
 *   3. Dragging a control handle moves the handle, not the anchor — the
 *      canonical edit-anchors gesture (currently `test.fixme`).
 *
 * On (3): all of the affordance hit-test wiring works. `affordanceAt` at
 * the control-point's world coord correctly returns `controlOut:N`.
 * `editAnchorsAction` checks `ctx.drag.affordance` at start time and
 * returns a real handle iff the affordance is anchor-kind. The dispatcher
 * now falls through on empty handles (added in this branch).
 *
 * What's still missing: every general-drag ongoing action — moveAction,
 * areaSelectAction, rotateAction, insertAction, insertRotateAction,
 * cloneAction, lassoSelectAction — declares a bare `{ kind: 'drag' }`
 * binding with no affordance gating. They're all registered before
 * editAnchorsAction in `useStandardActions`, and each returns a real
 * (non-empty) handle whenever its preconditions are met (selection
 * non-empty, dep present, etc.). So even with the empty-handle fallthrough,
 * one of them claims every drag — including drags on an anchor — before
 * editAnchorsAction is ever consulted.
 *
 * The systemic fix isn't to teach each action to opt out of every
 * specific-affordance kind (brittle, scales badly). The right move is to
 * have `matchSorted` sort matches by binding specificity within scope, so
 * a binding with a target predicate beats a bare-kind binding regardless
 * of registration order. Then editAnchorsAction.defaultBinding gets a
 * `target` predicate matching anchor-kind affordances, and it wins
 * automatically on anchor drags without any opt-outs needed.
 *
 * The probe + drag input plumbing in this spec is correct and ready —
 * `.fixme` flips to `test` once the dispatcher specificity ordering lands.
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

test.fixme('bezier-edit — dragging a control handle moves the handle, not the anchor', async ({ demo }) => {
  await demo.goto('bezier-edit');

  const before = (await demo.probe<HandleEntry[]>('handles'))!;
  // Vertex 1 has both an inHandle (220,60) and an outHandle (300,260).
  const v1 = before[1];
  expect(v1.handleOut, 'vertex 1 exposes an outHandle to drag').toBeTruthy();
  const startHandle = v1.handleOut!;
  const startAnchor = v1.anchor;

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
