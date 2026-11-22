I fixed both reviewer findings, and the carried finding no longer applies. Each fix has a test that failed before the change and passes after it, plus its own changeset.

Entered-group frame got a negative width or height on a flipped view axis (A): fixed fd0919e4a0. It now builds the rect with `viewRectToScreen`.

`present.step` and `present.go` stayed enabled when the request named no page, so their keys were swallowed instead of passing to the next binding (B): fixed 493d863f45. `enabled` and `run` now ask one shared helper which page the step would reach, so a step past either end without `wrap`, or a go to a missing page, reports disabled. The new test covers only the step past either end; nothing tests a go to a missing page.

[r42-9] `createCanvasCamera.target()` returned a stale heading during a glide it didn't start (carried): not a defect (no longer applies). `target()` now reads `canvas.viewAnimationTarget()`, which answers for any glide, whoever started it.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/core/src/domains/presentation/presentationContribution.test.tsx`: pass (5 passed)
- `npx vitest run --maxWorkers=1 packages/core/src/domains/selection/enteredGroupFrame.test.ts`: pass (8 passed)
- `npx vitest run --maxWorkers=1 packages/core/src/domains/presentation/presentationStep.test.ts`: pass (8 passed)
- `npm run check:changesets`: pass (OK — 138 changeset(s))
- `npm run checks:gate`: pass (all 33 passed)
- `npm run lint -w @weasel-js/core`: not run, because `@weasel-js/core` has no `lint` script. I ran `npx eslint` on the changed files instead: pass (exit 0).

The tree is clean apart from `.skulkr/`.

tally: 2 of 3 fixed, 0 extra fixed