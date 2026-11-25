- A rerun that throws counted as having run (A+B): fixed 297aee8d00
- The rerun ignored an immediate invoker's `'pass'` and the `eligible` rule (A): fixed 7d8ad8d199
- `holdPreview` closed over the descriptor it was given, so a mute, tuning or replacement missed the hold (A): fixed fedf13d539
- `begin` skipped the `eligible` rule and `enabled` (A): fixed 7b9d2bcabc
- `paramsOf` read tunings from the node it was called on, not the active leaf (B): fixed 135ef52ff7
- The hold ran the static descriptor even after the registry replaced, tuned or muted it (B): duplicate of fedf13d539
- A rerun that throws counted as having run, plus the related point that it ignores `'pass'` (B): duplicate of 297aee8d00 and 7d8ad8d199
- The rerun skipped the `eligible` rule (B): duplicate of 7d8ad8d199

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file: `lastOperation.test.tsx` 22 passed, `eligibleOutsideDispatch.test.ts` 5 passed, `trigger.test.ts` 3 passed, `holdPreview.test.tsx` 9 passed. Each new test failed before its fix.
- Other tests that reach the changed code: `registry.scopes`, `useOngoingAction`, `SceneCanvas.firstTool`, `refs.abandon`, `PathCommands`, `dispatcher.eligibility`, `dispatcher.resolveAll`, `containerActions`, `pathEditTools.canvas`, `keyHeld`, `dispatchRecord`, `tuning`, `lastOperation.ongoing`, `LastOperation.tools`, the pathfinder `keymap` and `action` tests: all pass.
- `npm run typecheck:packages -- routing`: pass.
- `npm run checks:gate`: "checks:gate: all 32 passed". An earlier run failed `check:changesets` on titles of 140 characters or more; I shortened them and folded the fixes into their commits.
- `npm run lint -w @weasel-js/routing`: fails with "Missing script: lint", because the package has no lint script. eslint on the changed files: pass.
- The tree is clean.

tally: 8 of 8 fixed, 0 extra fixed