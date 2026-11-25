- Content bounds skip a hidden-layer root's shown subtree and its copies (A): fixed 3a33a43265
- Gesture reason never shows for a gesture inside a `<CanvasView>` (A+B): fixed b637e6bd56. Each view registration now carries `worldToCanvas`, and `<GestureReason>` reads every registered view's dispatcher and places the reason through that view's camera and rect.
- `~*` / `~x` capped below 1.0.0 instead of matching any version (A): fixed 9f1ef84416
- `inkBoxes` reads member world poses from the shown scene, not the document (A): fixed 9a1b9064d6
- `defaultDrawOne` puts a label at (NaN, NaN) on a non-rect `Path` pose (A): fixed 4ffcff11a0. The label now anchors on the path's bounds. A pose with no position gets no label.

No extra defects found while fixing.

Each fix has its own `patch` changeset in `@weasel-js/core`. Nothing was added to `docs/unruled.md`.

Checks, all from the tree root:
- `npx vitest run --maxWorkers=1`, one file at a time: pass for each.
  - `packages/core/src/canvas/`: `contentBounds.test.ts` (5), `contentBounds.pbt.test.ts` (2), `SceneCanvas.contentBounds.test.tsx` (6), `kitRequirements.test.ts` (52), `inkBoxes.test.ts` (1, new), `defaultDrawOne.test.ts` (11), `GestureReason.test.tsx` (2), `CanvasView.clientToWorld.test.tsx` (3), `Canvas.viewRegistry.test.tsx` (4)
  - `packages/minimap/src/minimapMath.test.ts` (34)
  - Also passed during the work: `packages/core/src/canvas/CanvasView.camera.test.tsx` (10), `packages/core/src/interactions/actions/drawnBoxes.test.ts` (1), `packages/core/src/domains/snap/probes2d.test.ts` (8)
  - Each new test failed before its fix.
  - Unrun: `packages/core/src/canvas/GestureReason.browser.test.tsx` (browser test, not touched).
- `npm run typecheck:packages -- core minimap`: pass (core ok, minimap ok)
- eslint on the 14 changed source and test files: pass (exit 0)
- `npm run check:size`: pass ("no file or function grew past its cap")
- `npm run check:changesets`: pass ("OK — 1828 changeset(s)")
- Tree clean; nothing in `.skulk/` was touched.