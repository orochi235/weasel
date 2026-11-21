- Turned pool moves when a lane is resized (A): fixed 7678b71960
- Lane resize moves locked nodes in later lanes (A): fixed 505a07814f
- Releasing a lane moves locked members of later lanes (A): fixed 77c7308e52
- Pool shrunk below its lanes leaves them hanging out (A): fixed 9988e29d4c
- `addLane` throws on a negative or fractional index (A): fixed b501170265. This was my call: it now throws a `RangeError`, and an index past the end still adds at the end. It is recorded in `docs/unruled.md`.
- `addLane` with an explicit style skips the restripe of later lanes (A): fixed 752d8f03e5
- Hidden lanes still offer a resize boundary (A): fixed a8040ce1e3
- Drop-parent search misses a container overhanging its parent's body (A): fixed 07dfb5bf0f
- `addLane` places the lane in the pool's local frame whatever the composition (B): fixed 220dbf383d. This also covers a turned pool.
- Lane-resize commit leaves later lanes' members behind under a non-rigid composition (B): not a defect. Under `IDENTITY_POSE_COMPOSITION` a container carries nothing ("moving it moves nothing else"). The preview doesn't carry them either: `carriedDescendants` leaves them out, and a test showed their preview pose is null. So the preview and the commit already agree.
- `laneResizeFrame` previews titles in the local frame regardless of composition (B): fixed 7678b71960. This is the same rewrite as the turned-pool fix, because the commit now writes exactly the poses the preview shows. Each fix has its own changeset.
- Pool shrunk below its lanes, lanes spill out (B): duplicate of the A finding above (9988e29d4c)
- A point on the header/body edge counts as both header and body (B): fixed f364793faf
- Pool narrower than its header gets negative-width lanes (B): fixed 876c96a767. The scene already corrected them once the layout ran, but the ops `containerBuild` returns carried the negative widths. `firstLanes` and `addLane` now both build lanes inside the body.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: containerActions.test.ts pass (18), containers.scene.test.ts pass (21), laneStack.test.ts pass (9), containerTheme.test.ts pass (4), canDropInto.test.ts pass (13), containerTitle.test.ts pass (2), containerActions.pbt.test.ts pass (1). No browser test files were touched.
- `npm run checks:gate`: the first run failed 1 of 32 (`check:changesets`: a changeset title ran 151 characters). I shortened it and amended that commit. The rerun printed "checks:gate: all 32 passed".
- `npm run lint -w @weasel-js/diagram`: fail. The package has no `lint` script ("Missing script: "lint""). In its place, `npx eslint` on every changed diagram file passed with exit 0.
- `git status`: clean.

tally: 13 of 14 fixed, 0 extra fixed