7f4f1c3bf5 custom layers chained to a dangling or cyclic layer were sent to the tail in map order (A) | fixed 7f4f1c3bf5

toPoseReads read the parent from `parentId`, which kit nodes don't have (A) | fixed 57dcda7183

drawnBoundsOf counted a group member on a hidden layer (A) | fixed 125ae5ad8f

orphaned layer chain came out reversed at the tail (B) | duplicate of the first finding (A), fixed 7f4f1c3bf5

sceneContentBounds counted the copies of a container inside a boolean's operands (B) | fixed c8b7ae1369

GestureReason's tag stayed put when the camera moved without a dispatcher notification (B) | fixed a97f73ecfc

Extra (sweep): sceneContentBounds also went down into the operands of a consuming node on a hidden layer, which the render walk never paints | fixed c8b7ae1369 (same commit as the copies fix)

Notes on the fixes:
- **Layer order:** layers still get one warning each, in map order. The property test now only requires the orphans to fill the tail, each on its declared side of an orphan anchor. Before, it pinned them to map order.
- **drawnBounds:** `DrawnBoundsScene` gains an optional `layers` field, and `drawnBoundsScene` fills it in. `hiddenLayerIds` was added to nodeGates and is internal, not exported.
- **GestureReason:** it gains an optional `canvasApi` prop (`subscribeFrame`), and SceneCanvas passes it once the canvas is ready. Any camera move repaints the surface, so this one subscription covers both the surface camera and a `<CanvasView>` camera.

Checks:
- Before each fix, its new test failed: layerOrder.test.ts, layerOrder.pbt.test.ts, buildSceneLayer.derived.test.ts, drawnBounds.test.ts, contentBounds.test.ts and GestureReason.test.tsx.
- After the fixes, run one at a time with `npx vitest run --maxWorkers=1`:
  - layerOrder.test.ts + layerOrder.pbt.test.ts: pass (30/30)
  - buildSceneLayer.derived.test.ts: pass (6/6)
  - drawnBounds.test.ts: pass (20/20)
  - derivedPath*.test.ts, derivedPathCull.test.ts, drawnBounds.marks.test.ts, inkBoxes.test.ts, nodeGates.test.ts: pass (64/64)
  - contentBounds.test.ts + SceneCanvas.contentBounds.test.tsx: pass (13/13)
  - contentBounds.pbt.test.ts: pass
  - GestureReason.test.tsx: pass (3/3)
- GestureReason.browser.test.tsx: unrun (browser).
- `npm run check:changesets`: pass ("OK — 6 changeset(s)").
- `npm run checks:gate`: pass ("checks:gate: all 32 passed").
- `npm run lint -w @weasel-js/core`: not run — `@weasel-js/core` has no `lint` script (npm says "Missing script"). I ran eslint on every file I touched instead: pass, no output.

tally: 6 of 6 fixed, 1 extra fixed