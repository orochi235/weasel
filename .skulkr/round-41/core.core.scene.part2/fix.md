nodeAsShown stale after a pose or flag is written in place (A): fixed c7708602cf

Tween spaced by distance (or with an infinite `steps`) never stops adding steps (A): fixed d2e0dc5d6c. Strict call: at most 4096 steps (`MAX_TWEEN_STEPS`), a development warning when it caps, `steps: NaN` draws none. Recorded in `docs/unruled.md`.

Removal reports a descendant the same change added (A+B): fixed b00bfe4852

A child removed under its parent and put back in the same change is reported as added (A): fixed 3ebc9bd198. A child left out when only its parent comes back is now still reported removed, with that parent as its parent.

Layout pass never re-arranges the parent of a container it resized (A): fixed 3767a216c2

outsideGeneration, a sum, falls back to an old value when a source is removed (A+B): fixed 9f7b0ccf4b. Removing a source adds its last value plus one to a fixed offset, so the total only grows.

NodeBase.dependsOn doc says "fixed at add time" (A): fixed 92963f3a45. Doc only, so no changeset.

reconcileSpecs reorder moves a child no spec names (B): fixed e8de8eef0e

A pose hold frame notifies once per id instead of once (B): fixed 0161b67bb4

No extra defects found beyond these. The sweep found no other sum-of-generations or unbounded station loop in the area.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - pass: nodeAsShown.test.ts, pathEffects/tween.test.ts, scene.poseWrites.test.ts, outsideReads.test.ts, reconcileSpecs.test.ts, reconcileSpecs.locked.test.ts, poseHold.test.ts, poseOverrides.test.ts, poseOverrides.plies.test.ts, layoutPass.resize.test.ts, layoutPass.carry.test.ts, layoutPass.frame.test.ts, scene.layout.test.ts
  - pass: interactions/actions/resolvePreviews.test.ts, guides/…/moveAction.layoutCommit.test.ts
- `npm run checks:gate`: first run failed 3 of 32: check:changesets (a title too long), check:size (runLayoutPass 126 lines), check:proto-index (nodeAsShown `b[key]`). I fixed all three and folded the fixes into their commits. Rerun: all 32 passed.
- `npm run lint -w @weasel-js/core`: fail. The package has no `lint` script ("Missing script: lint"). The gate's root `npm run lint` passed, and `npx eslint` on every changed .ts file passed.
- The tree is clean.