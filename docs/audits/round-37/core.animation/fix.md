- `rig.bake()` throws once a bound or skinned node is deleted (A): fixed aa8e7fb5b1
- `useRigNode` / `rigFromNode` lose the skin of a `__proto__` node id (A+B): fixed 2d1bdc4209
- `scenePoseTarget` keeps, and hands back, the target of a node deleted while at rest, and its cache grows without bound (A+B): fixed cf0fc53804. A lookup now drops the stale target, and the table clears out at-rest targets of deleted nodes each time it doubles. No test covers the clearing on its own, because the table's size can't be seen from outside.
- `animateLifecycle` gets stuck in `leaving`, or leaves the node at its enter pose, when `tweenPose` throws (A): fixed 045d441dee. This needed a behavior call, which is recorded in `docs/unruled.md`: the error still throws, the inserted node is left at its own pose, and the node can be removed again.
- `animateLifecycle` removes a node that is inserted again while its exit animation runs (B): fixed 6ab827e1ac
- `animateOnSetPose` / `animateLifecycle` keep their 200 ms default under `prefers-reduced-motion` (A): fixed 3ff8b44b85. They now follow round nineteen's ruling and share one `defaultMotionMs` with the reflow glide. A `spring` option still springs, and that call is recorded in `docs/unruled.md`.
- `momentum`'s `boundary: 'stop'` lets a node slide along an edge over an adapter with no pose targets (A): fixed 2f357f2bcd
- `momentum`'s pose-target coast writes the document with no history entry after an outside cancel (B): fixed a33e81740e. This needed a behavior call, recorded in `docs/unruled.md`: the flick is recorded where it stopped, as one undo step. Round six's line on the `previewPoses` path stands. The editing test's stub animator gained a `watch` method.
- A rewinding tween ends a leg early under an easing that overshoots (B): fixed 905cf4f9e0
- A skinned node with a rotated pose gets its rotation applied twice when baked (B): not a defect. `PoseDescriptor.fromBounds` is documented to carry none of the template's shape, and every kit descriptor drops rotation there. The existing test "skins a turned node from where it is drawn, and shows it with no turn left to apply" covers this case.

No extra defects found. The only knock-on was that the fix in a33e81740e pushed `coastOnTargets` to 134 lines, over the 120-line cap. Two helpers were split out of it in the same commit.

Checks:
- `npx vitest run --maxWorkers=1`, run one file at a time:
  - `momentum.boundary.test.ts`: 1 passed
  - `poseHelpers.rewind.test.tsx`: 8 passed
  - `poseTarget.test.tsx`: 13 passed
  - `bindRig.test.ts`: 13 passed
  - `rigNode.test.tsx`: 8 passed
  - `skinRig.test.ts`: 13 passed
  - `animateLifecycle.test.ts`: 10 passed
  - `animateOnSetPose.test.ts`: 6 passed
  - `move.lifecycle.test.ts`: 21 passed
  - `momentum.targets.test.tsx`: 8 passed
  - Also run, untouched neighbors: `reflow.test.tsx` 24 passed, `wrappers.scene.test.tsx` 5 passed, `clipTargets.test.tsx` 3 passed, `target.read.test.tsx` 28 passed, `move.momentum.test.ts` 5 passed, `momentum.test.ts` 9 passed, `momentum.otherWriters.test.ts` 3 passed
- `npm run typecheck:packages -- core editing`: "1/2 core ok", "2/2 editing ok"
- eslint on every changed file: pass
- `npm run check:size`: "sizes: no file or function grew past its cap."
- `npm run check:changesets`: "[changesets] OK — 1729 changeset(s)."
- No browser test files were touched. The tree is clean apart from `.skulk/`.