- resolveVisibility reads chrome ids through `Object.prototype` (A+B): fixed 84b48af114
- a rule set to `undefined` replaces the kit default with "always visible" (A): fixed f7ce6c670b. The same spread also lost the preset's rule in `useChromeRules` (`useSceneChrome.ts`) and in the `chromeRules` dep. All three now merge through `mergeVisibilityRules`, which skips `undefined` values.
- createCanvasCamera keeps a stale glide target and reports it during someone else's glide (A+B): fixed faa2dcad97. Adds `SceneCanvasApi.viewAnimationTarget()` (api changeset) and the optional `PresentationCanvas.viewAnimationTarget`, which the camera reads first. A handle without it clears the camera's heading through `onDone` once its own glide ends.
- present.go can't reach a page whose id is `'first'` or `'last'` (A+B): fixed 266cddb50a. I made the call and recorded it in `docs/unruled.md` under a new "Audit round forty-two" section:
  - `PageRequest` gains `{ end: 'first' | 'last' }`, and the Home/End step variants send it.
  - A `{ to }` now matches a page id before it is read as an end, so old `{ to: 'first' }` callers still work.
- arrivalBounds applies its 24 px cascade in world units (B): fixed 9be97d73ed.
  - `IngestCtx` and the `ingestion` dep gain an optional `worldPerPx()`, signed so a flipped view steps down on screen.
  - `<SceneCanvas>` and `<CanvasView>` supply it.
  - The editing ingest action and the drop ghost pass it on.
- a `usePoseRun` step that throws leaves the run stuck as running (B): fixed 4d622b7b83
- enteredGroupScope only bumps its version while someone is subscribed (B): fixed 0dc32916e0

Extra defect (sweep):
- the `chromeRules` dep's `get` also read ids through `Object.prototype`: fixed 10bb682e03

Checks:
- Each touched test file alone, `npx vitest run --maxWorkers=1 <file>`: pass
  - useSceneChrome.test.tsx 2/2
  - chromeRules.test.tsx 2/2
  - resolve.test.ts 2/2
  - placement.test.ts 3/3
  - usePoseRun.test.ts 17/17
  - presentationContribution.test.tsx 4/4
  - presentationStep.test.ts 9/9
  - enteredGroupScope.test.ts 8/8
  - ghost.test.ts 8/8
- Each new test failed against the code before its fix.
- Also run (not a touched file, run through `npm test -w`, not `--maxWorkers=1`): chrome-caps.test.ts 39/39, useChromeCaps.test.tsx 11/11, ingest.test.ts 7/7, perViewRouting.test.tsx 3/3, useCanvasIngestion.test.tsx 13/13: pass
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed 4 of 32 (typecheck, audit:jsdoc, check:size, typecheck:packages); the fixes were folded into their commits before the rerun.
- `npm run check:changesets`: "OK — 1940 changeset(s)."
- `npm run lint -w @weasel-js/core` and `npm run lint -w @weasel-js/editing`: not run, because neither package has a `lint` script ("Missing script: lint"). Instead, the root `npm run lint` passed inside the gate, and `npx eslint` on every changed file: pass.
- No browser tests touched. The tree is clean, with eight commits on top of ef1c25bd7a.