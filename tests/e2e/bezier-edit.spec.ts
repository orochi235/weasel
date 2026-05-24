/**
 * Pilot for the `bezier-edit` demo. Covers:
 *   1. Probe pins the initial S-curve anchor / handle geometry.
 *   2. The "Add point" button extends the path with a new cubic.
 *   3. Dragging a control handle moves the handle, not the anchor — the
 *      canonical edit-anchors gesture (currently `test.fixme` — see below).
 *
 * On (3): all of the wiring exists. `editAnchorsAction` is registered by
 * `useStandardActions`; `buildAffordanceAt` is configured with a
 * `getAnchorState` thunk; the `editAnchors` dep's default heuristic picks
 * the first selected polygon as `editingId`; affordance hit-testing returns
 * `controlOut:N` at the exact control-point coord. But the dispatcher
 * picks the first matching binding in ambient-scope registration order and
 * does NOT fall through when `start()` returns an empty handle. Since
 * `moveAction` (registered before `editAnchorsAction` in `useStandardActions`)
 * also binds bare `{ kind: 'drag' }`, every drag — including drags on a
 * control point — short-circuits at moveAction's start, which returns a
 * real ongoing handle (it ignores affordance). `editAnchorsAction.start`
 * never runs.
 *
 * Two possible fixes, neither in scope here:
 *   (a) Give `editAnchorsAction.defaultBinding` a target predicate that
 *       matches only anchor-kind affordances — boosts its specificity past
 *       the bare `kind: 'drag'` of moveAction/areaSelectAction.
 *   (b) Have the dispatcher treat an empty `{}` start-result as
 *       "not handled" and fall through to the next match.
 *
 * The probe + drag input plumbing in this spec is correct and ready —
 * `.fixme` flips back to `test` once either fix lands.
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
  // See file-level doc comment. Spec is ready; blocked on dispatcher precedence.
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
