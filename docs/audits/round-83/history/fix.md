Parent edit coalescing across a suspended journal's edits (A): fixed 9d94d80c12
Closed nested journals kept alive by the enclosing journal (A): fixed ce31756d48
Closed nested journals' `children`/`lastEdit` growing (B): duplicate of "closed nested journals kept alive" (A)
`resumeJournal` through a history that didn't open the journal (A): fixed 688dbaf0d0. This was a strict call: it now throws and leaves the journal suspended. Recorded in `docs/unruled.md`.
Resuming a top-level journal through a different history (B): duplicate of "`resumeJournal` through a history that didn't open the journal" (A)
Throwing `invert()` during rollback replaces the original error (A): fixed 457cef6132. The coalesced-entry settle path had the same flaw and is fixed in the same commit.
`historyLimit: NaN` disables the cap (A): fixed ebcf8a9111. This was a strict call: it now throws a `RangeError`. Recorded in `docs/unruled.md`.
`historyLimit: NaN` disables the cap (B): duplicate of the A finding above
Branching snapshot restored into a non-branching history (A): fixed d122eebb9b. This was a strict call: the branches are dropped with a warning on the `debug` logger. Recorded in `docs/unruled.md`.
`snapshotFault` accepts duplicate entry ids (A): fixed 8913bd513f
History's own `rebuildOp` returning `undefined` throws a TypeError (B): fixed a52e0eb6e4
`recordEntry` stores the caller's ops array by reference (B): fixed 8a436e6ee8
`recordEntry` never reads `caused()` (B): fixed eb63fb028c
Op-key coalescing keeps only the first and latest batch, so relative ops undo wrong (B): fixed f6f6b2c5af. This is a docs fix: the docs now say keyed ops must write absolute values, and point relative edits at `recordEntry`'s `coalesceKey`. The merge itself is unchanged.
Enclosing journal's `cancel` undoes a suspended child's edits before its own later ones (B): fixed fe5db6d621

Extra: commit 1866edf50b only trims `createHistory` and `createJournalInternal` back under `check:size`'s 120-line function limit. It is not a separate defect.

Checks:
- Each touched test file, run alone with `--maxWorkers=1`: history.branching pass, history.limit pass, history.rebuild pass, history.recordEntry pass, history.restoreShape pass, history.throwingInvert pass, journal.cancel pass, journal.children pass, journal.resume pass, journal.sealsParent pass
- Whole `packages/history` directory: pass (229 tests)
- `.skulkr/in/on-fleet typecheck 15 checks -- npm run checks:gate`: pass, "checks:gate: all 33 passed". The first run failed `check:size`; 1866edf50b fixed it and the rerun passed.
- `npm run typecheck:packages -- history`: pass
- `npm run check:changesets`: pass
- `npm run lint -w @weasel-js/history`: the package has no `lint` script. `npx eslint packages/history/src` instead: pass.

tally: 15 of 15 fixed, 0 extra fixed