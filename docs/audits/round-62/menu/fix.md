[r53-1] Hovering a separator left a pending submenu open running (carried): not a defect (no longer applies). Commit 7977b94841 now treats a hover over a separator as a hover over no row, so it cancels the pending open the same way padding does. The test in `packages/menu/src/controller.test.ts:186` covers it.

[r53-2] A letter typed mid-search was taken as an access letter or a number-row step (carried): not a defect (no longer applies). Since commit 6a59fd6ce8, `planKey` adds any single character typed mid-search to the search first, as long as the search still finds a row. The tests in `packages/menu/src/keyPlan.test.ts:40` and `:52` cover it.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/menu/src/controller.test.ts packages/menu/src/keyPlan.test.ts`: pass (Tests 41 passed (41)).
- `npm run checks:gate` and `npm run lint -w @weasel-js/menu`: not run, because I made no commits and the tree is unchanged and clean.

tally: 0 of 2 fixed, 0 extra fixed