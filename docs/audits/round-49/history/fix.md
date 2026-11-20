Suspending a journal while a journal inside it is active (A+B): fixed eee58c69b6. `suspend` now throws in that case. Strict call, recorded in `docs/unruled.md` in f038878081.

Parent `apply`/`applyOps`/`recordEntry`/`restore` running under an active journal (A): fixed d5cc6e252b. Strict call, recorded in `docs/unruled.md` in f038878081.

Raw history's mutators not refusing under an active journal (B): fixed d5cc6e252b, for `apply`, `applyOps`, `recordEntry` and `restore`. Not a defect for `clear`, `prune`, `dropRedo` and `switchBranch`: none of them leaves an entry describing a state the document is not in. That choice is recorded in `docs/unruled.md`.

A throwing `selection.set` during undo/redo leaving the entry on its old stack (A): fixed f9d3e2ff48. The entry now moves before its selection is restored, and undo/redo report what moved even when they throw.

Empty restored branch making `branches()`/`switchBranch()` throw TypeError (A): fixed e007c6712c.

`createSwapOp`'s inverse having no `name`/`args` (A): fixed 51a2a3105d.

A goto whose walk back also throws not telling `observe` (A): fixed 78e174126c. The step lists both walks.

Restore not bumping `nextEntryId` past the floor and fork points (A): fixed 944ffa7c87.

Restore accepting any `version` (A): fixed 36d2bff0be.

Suspend leaving the inner journal active (B): duplicate of the first finding (A).

Cancel unwinding children in the order they were opened (B): fixed b78dd8d7cb. Children are now unwound latest edit first. Edits interleaved between suspended siblings still can't be unwound exactly in any order; that is recorded as Open in `docs/unruled.md`. The second point, two children active at once during cancel, is not a defect: it lasts only inside `cancel` and ends with every child closed.

`undo`/`redo` skipping the journal refusal on an empty stack (B): fixed c0ce7d1cf8. `goto` to the current depth now refuses too.

Restore not bumping past `floor`/`at` (B): duplicate of the restore-id finding (A), fixed 944ffa7c87.

Restore never checking `version` (B): duplicate of the version finding (A), fixed 36d2bff0be.

`createSwapOp`'s inverse anonymous (B): duplicate of the swap finding (A), fixed 51a2a3105d.

Extra: none. c6a65ae053 splits `createHistory` and `createJournalInternal` back under check:size's 120-line function cap after these fixes, and shortens the changeset titles.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: pass for each touched file — `journal.suspend` (4), `journal.exclusivity` (10), `journal.cancel` (5), `history.selection` (10), `history.throwingStep` (7), `history.restoreShape` (2), `history.test` (28) and `createSwapOp` (4).
- Same, related files: pass for `journal.nested` (8), `history.observe` (6), `history.pbt` (1) and `history.branching` (16).
- Same, consumers: pass for core `scene.journal` (11), `sceneJournals` (3), `scene.restoredOps` (10) and `sceneAdapter.journal` (4), and for draw `integration.endToEnd` (2) and `useTextEditSession` (11), and theme-editor `useLabHistory.persist` (11).
- `npm run checks:gate`: first run failed (`check:changesets` on title length, `check:size` on two functions). After the fixes: "checks:gate: all 32 passed".
- `npm run lint -w packages/history`: unrun. The package has no lint script (only `build` and `test`), and this machine's hook refused the command. eslint on all 15 changed files in the package: pass (exit 0).
- No browser tests were touched.

The tree is clean apart from `.skulk/`.

tally: 15 of 15 fixed, 0 extra fixed