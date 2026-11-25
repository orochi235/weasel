fixed 2c87d18249 | `kit:add`'s revert leaves the removed node in other sessions' selections (A)

fixed 9236085006 | `kit:setLayer`'s revert leaves a node on a hidden or locked layer selected (A+B)

duplicate of the line above | the `kit:setLayer` revert finding from B

fixed 69434ac0ca | the dependency memo never re-checks a dependency's inherited paint, so a container's fill change leaves a derived node stale (B)

not a defect (the `handler.apply`/`handler.revert` dereference sits inside the per-op `try`, so a kind that is no longer registered throws a TypeError that gets caught and warned; the other ops are still taken back, the selection is restored, and `fn`'s error is rethrown; a test of exactly this passed against the unfixed code) | a failed atomic edit with an unregistered op kind escapes the revert loop (B)

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/core/src/core/scene/scene.revertNarrows.test.ts`: pass (2/2; both tests failed before their fixes)
- `npx vitest run --maxWorkers=1 packages/core/src/core/scene/depMemo.test.ts`: pass (8/8; the new test failed before the fix)
- Neighbors of the memo change: derivedPath, derivedDep, derivedPose, fontReads, and scene.derived test files: pass
- `npm run checks:gate`: "checks:gate: all 33 passed"
- `npm run lint -w @weasel-js/core`: not run, because `@weasel-js/core` has no lint script ("Missing script"). The gate's root `npm run lint` passed.

tally: 3 of 5 fixed, 0 extra fixed