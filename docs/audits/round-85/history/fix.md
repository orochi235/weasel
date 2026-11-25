- A listener's seal/undo on a push or coalesce was overwritten by `anchor()` running after `bump()` (A): fixed bbe21f38ff
- `recordEntry` and journal-commit steps reported `applied = forwardOps` though the step applied nothing (A): fixed a43de11a77
- The coalesce step's `ops` was truncated to the new ops on the `recordEntry` fold path (A): fixed e27fc53410
- A failed undo of a coalesced entry whose halves share ops replayed the own half after the shared ops and left the value stale (B): fixed aed448ae67. Unwinding now replays the other half op for op when the halves line up, and falls back to the old settle when they don't.
- A grandchild journal's edits didn't count as its parent's latest edit, so an enclosing cancel unwound in the wrong order (B): fixed 6ade6a8c3c. The test uses edits made entirely after the enclosing journal's own edit. With edits on both sides of it, as in B's exact scenario, final state comes out the same either way, and the code already documents that interleaved case as unfixable.
- `activeJournal()` answered the outer journal while a nested one was active, and that journal refuses every edit (B): fixed 20e17119f3. It now answers the innermost open journal. Core's scene uses its own innermost-journal logic, so it is unaffected.

No extra defects found. Each fix has its own changeset.

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file: history.coalesceAnchor 12 passed, history.observe 8 passed, history.sharedHalves 5 passed, journal.cancel 7 passed, journal.nested 9 passed (all of packages/history: 247 passed)
- `npm run checks:gate`: all 33 passed. The first run failed 5 of 33: typecheck, check:needs and ui-canvas on a narrowing error, plus check:part-caches and check:size on journal.ts. I fixed them by folding the journal's maps into one, and autosquashed the fixups into the commits they belong to.
- `npm run lint -w @weasel-js/history`: not run, because the package has no `lint` script. `npx eslint packages/history/src`: pass.

tally: 6 of 6 fixed, 0 extra fixed