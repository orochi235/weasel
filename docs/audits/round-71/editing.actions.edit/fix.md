selectAll selects a group and its members together (B): fixed 9a4125d6a7

setFillOpacity and setStrokeOpacity turn a None paint back on in the default color (A): fixed fb98ae6f64. This needed a behavior call and I made the strict one: a fill or stroke set to None (`null`, or a record with no `paint`) stays None, and only a node with no fill or stroke at all gets the default. It is recorded in `docs/unruled.md`. Round 70's setStrokeOpacity test expected a `{}` stroke to get a default paint, so I rewrote that test to the new rule.

setStrokeWidth handles a None stroke two ways, giving `stroke: null` a default-colored stroke (A): fixed 166e4acaa9. A `null` stroke now takes the width and stays unpainted, like a paint-less record. The same `docs/unruled.md` line covers it.

The test fake `FakeScene.get` returns `null` for a missing id where the real scene returns `undefined` (A): fixed e3785dfb3b. This is a test-only change, so it has no changeset. With the old fake, a stale selected id crashed the new test.

setVertexColor writes channels outside 0..1 without clamping (B): fixed 00fe6721f1

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: selectAll.test.ts pass (13), setFillOpacity.test.ts pass (10), setStrokeOpacity.test.ts pass (9), setStrokeWidth.test.ts pass (7), setVertexColor.test.ts pass (5).
- The other test files that import paintActionTestUtils: all pass (group.locked, pageStructure, paintUnchanged, paintInherit, paintParams, setStroke, paintTargets, setFill).
- The selectAll integration tests: SceneCanvas.enteredGroupTools, the integration pageStructure, group.outermost, SceneCanvas.actions, and SceneCanvas.actions.behavior all pass.
- `npm run check:changesets`: pass (`OK — 454 changeset(s)`).
- `npm run checks:gate`: pass (`checks:gate: all 33 passed`).
- `npm run lint -w @weasel-js/editing`: did not run, because the package has no `lint` script ("Missing script: \"lint\""). `npx eslint` on every changed `.ts` file passed instead.

tally: 5 of 5 fixed, 0 extra fixed