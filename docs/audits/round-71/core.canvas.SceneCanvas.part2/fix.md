- A partial `actions` merge kept a sibling canvas's fields after that canvas unmounted (A): fixed c6e72e3f4e
- `askedOwnView` ignored `viewId`, so a pick from another view read the surface's id frames and LOD rungs (A): fixed 224e4c040b
- Hover in a declared view dropped the view's camera, so parallax layers were hovered in the wrong place (A): fixed df036e08eb
- `viewport={{ inertia }}` without the `view` preset warned falsely, though hand-tool inertia still works (A): fixed 2403c71c0b
- `doubleClickNames` froze the entered group when the memo ran (B): fixed 08572a4750
- A press in a `<CanvasView>` picked through the surface's layer gate, camera, id frames and LOD, unlike hover (B): fixed 5304fdf578 (view's camera and layer gate); the id-frame and LOD part is the same defect as A's `askedOwnView` finding, fixed in 224e4c040b
- `tools={{ id: true }}` for a preset's own tool warned that no such tool is offered (B): fixed ea3fb9f539
- Departing ghosts drew a clipping container's children unclipped (B): fixed 1c81f0b965
- A node removed from under a hidden container that is still in the scene faded out visibly (B): fixed ba2c807729

No extra defects found while fixing. Nothing went into `docs/unruled.md`, since no behavior call was needed.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time, all pass:
  - `useScenePicking.test.ts`: 1 passed
  - `useViewportWithoutView.test.ts`: 2 passed
  - `toolRegistry.test.ts`: 18 passed
  - `useDepartureGhostLayer.test.tsx`: 9 passed
  - `useScenePickers.pixels.test.tsx`: 10 passed
  - `useScenePickers.views.test.tsx`: 2 passed
  - `useActionsPropResolver.test.tsx`: 5 passed
  - `useSceneChrome.test.tsx`: 2 passed
  - `useScenePickers.parallax.test.tsx`: 10 passed
  - `useScenePickers.picking.test.tsx`: 18 passed
- Each new test was confirmed failing against the pre-fix code.
- `npm run checks:gate`: "checks:gate: all 33 passed"
- `npm run lint -w packages/core`: core has no `lint` script ("Missing script: lint"). Instead I ran eslint on every changed file (clean), and the gate's own `npm run lint` passed.
- `npm run check:changesets`: "OK — 459 changeset(s)."
- `npm run check:size`: "sizes: no file or function grew past its cap."
- The tree is clean.

tally: 9 of 9 fixed, 0 extra fixed