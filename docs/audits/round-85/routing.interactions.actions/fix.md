Six fixes are committed, one per finding, on top of the frozen tree. B's two duplicates are covered by A's fixes. The rest of B3 is not a defect: the dispatcher already catches a throw from `onEnd`.

- Gesture handle given to the dispatcher is a spread copy, so `this` state splits and class methods are lost (A) — fixed c8500e5fc7. The handle is now wrapped in a Proxy that calls every method on the handle itself.
- Spread-copy handle (B) — duplicate of A's spread-copy handle finding.
- An emptied yoke left as the active child makes the root resolve to an empty yoke (A) — fixed cf2aaa3f53. `leaf()` now skips an active child with no canvas under it, the same test `newestMember` makes.
- `rankedDepRegistry` loses its rank when given `{ rank: undefined }` (A) — fixed 16fd6d0be2.
- `checkEnabled` JSDoc names the wrong reason, `'(predicate threw)'` (A) — fixed 1a242656a6. Doc-only, so no changeset.
- Wrong reason in the `checkEnabled` doc (B) — duplicate of A's `checkEnabled` doc finding.
- The last operation outlives its `<InputScope>` and adjusting it reruns against the parent's deps (B) — fixed afde81f18c. The operation now ends when the scope it ran in unmounts.
- A hold runs with params resolved at the press, and its run is unguarded (B):
  - Stale thunked params — fixed f97f2c1fb8. The release re-resolves params before `checkEnabled` and the run.
  - Unguarded throw — not a defect. The dispatcher catches and logs a throw from `onEnd` (`gestureRun.ts:57`, `uiOngoing.ts:67`).

No extra defects found.

I also squashed changeset-title fixup commits into their fixes with a non-interactive `rebase --autosquash` on top of the frozen commit. The four titles had been over the 140-character warning.

Checks:
- `npx vitest run --maxWorkers=1`, each file on its own: `lastOperation.ongoing.test.tsx` pass (14), `lastOperation.test.tsx` pass (23), `scopeNode.test.ts` (new) pass (1), `depNode.test.ts` pass (13), `holdPreview.test.tsx` pass (10). Each new test failed before its fix, except `scopeNode.test.ts`, which I didn't run against the old code.
- `npm run checks:gate`: "checks:gate: all 33 passed"
- `npm run lint -w @weasel-js/routing`: not run, because `@weasel-js/routing` has no `lint` script. The root `npm run lint` passed inside the gate.
- `npm run check:changesets`: "OK — 1295 changeset(s), 113 with warnings", none of the warnings from my changesets.
- The tree is clean.

tally: 8 of 8 fixed, 0 extra fixed