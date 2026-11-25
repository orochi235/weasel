- Live lens cell left its old request standing when its comparison turned on or off (A+B): fixed 260886345a
- Capture refused state with undefined entries, or no state at all, while config was stripped of them (A+B): fixed 48392f460b. This also reverses an existing test assertion that refused `{ gone: undefined }`, so the state is now handled the same way as config.
- After a 503, a successful capture never set the status back to available (A+B): fixed ce9610575d
- `usePixelsSource` built its source once from the first `LoupeCaptureContext` (A): fixed 219663b9bc. The test probe now passes a stable ref instead of a new object each render, as `ForgeLoupe`'s `useLatest` does.
- The compare menu grouped submenus by their display label (A): fixed 56a1b96d50. `CompareChoice` gains a `groupKey` field.
- The token chain cache missed CSSOM edits to existing sheets (B): fixed 5a70929760. The key now includes each applying sheet's identity, its rule count, and its first and last rule objects. That catches `insertRule`, `deleteRule`, `replace`/`replaceSync`, sheets being adopted, swapped or disabled, and `sheet.disabled` toggles. An in-place edit of one rule's declarations is still missed, and the doc comment says so.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file: all passed.
  - liveSource.test.ts: 8 passed (8)
  - capturePayload.test.ts: 16 passed (16)
  - captureClient.test.ts: 3 passed (3)
  - CaptureInputs.test.tsx: 2 passed (2)
  - CompareMenu.test.ts: 9 passed (9)
  - tokenChain.test.ts: 4 passed (4)
  - readouts.test.tsx: 26 passed (26), run because it counts stylesheet reads
- `tokenChain.browser.test.tsx` was not run (browser test).
- `npm run checks:gate`: "checks:gate: all 33 passed". The first run failed on `check:changesets` (two titles too long) and `check:part-caches` (my id `WeakMap` is now a `createPart`). Both fixes were folded into their commits and the rerun passed.
- `npm run lint -w @weasel-js/forge`: did not run, because forge has no `lint` script ("Missing script"). Instead, `npx eslint packages/forge/src/shell/loupe/` exited 0.

tally: 6 of 6 fixed, 0 extra fixed