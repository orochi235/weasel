Removed-and-back pose write reports the override pose as `from` (A): fixed 5c81ce1f51

`createNestedHitTester` returns `pickable: false` nodes, and its ancestor climb loops on a parent cycle (A): fixed bc10e16a72 (pickable) and b1a06717cf (cycle)

`OpTable.handlers` doc says re-registering replaces, but `register` throws (A): fixed 236e35dadb

Setting the output grid throws when an off-grid node is locked (B): fixed 0de5a6f5f7. This needed a behavior call: the quantize pass now leaves locked nodes as stored, the way diagram's passes leave a locked connector alone. A write made inside `scene.unlocked` is not snapped either. Recorded in `docs/unruled.md`.

Dev freeze stops at an already-frozen object, leaving nested values writable (B): fixed 0d44076a89

Nested hit tester hangs on a parent cycle (B): duplicate of A's `createNestedHitTester` cycle finding, fixed b1a06717cf

Extra defects found while fixing:

A node moved, then removed and put back in one change, lost its original `from` in `onPoseWrite` (sweep): fixed 5c81ce1f51, in the same commit as A's finding, with its own test.

Changeset titles over the 140-character warning (sweep, my own changesets): fixed 28863a95ba

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file:
  - `nestedHit.test.ts`: pass (10)
  - `owned.test.ts` (new): pass (2)
  - `outputGrid.test.ts`: pass (9)
  - `scene.poseWrites.test.ts`: pass (18)
  - `opTable.test.ts`: pass (2)
- The new tests failed before their fixes, except the parent-cycle test, which I did not run against the old code because it would hang.
- `npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run check:changesets`: pass ("OK — 738 changeset(s).")
- `npm run lint -w @weasel-js/core`: core has no lint script (npm error: missing script). The root `npm run lint` inside the gate passed.
- No browser tests touched. Tree clean.

tally: 6 of 6 fixed, 1 extra fixed