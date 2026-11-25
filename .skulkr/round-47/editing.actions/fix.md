- Flip reads every node through the base pose descriptor and ignores `forNode` (A): fixed 4a4a8312b1
- Flip's `enabled` throws when there are operands but no scene (A): fixed 8f481803e2
- Make Boolean Group doesn't strip page structure (A): not a defect. `rootsAmong` already runs `withoutPageStructure` (`packages/core/src/interactions/actions/selectionSubtree.ts:14`). A test selecting a page alongside its content passed before any change.
- Lasso's default commit and `selectFromLasso` answer a degenerate lasso differently (A+B): fixed db7c8c1ce4
- Clone preview hands a singular-frame copy's `null` pose to the quantize rule (A): fixed 21d1de3d44. It was worse than reported: the rule threw out of `onMove` on every move.
- Swap is enabled over an envelope with a locked member, and its commit writes that member (B): fixed cc8f9e5787 (changeset title shortened in 8c4169c111)
- Flip, Align, Distribute, and Rotate write the locked member of a selected envelope (B): fixed cc8f9e5787. Before the fix I ran it: Flip, Align, and Swap were each enabled and their `run` threw from the lock guard.
- Make Boolean Group is enabled for a selection spanning layers, then does nothing (B): fixed a05392b018
- `transformSelection`'s doc says to require `selection`, but it reads `operands` (B): fixed 304bda449c. Docstring only, so no test.
- A clone dropped into another container stores an envelope's children in the source's frame (B): fixed 07f6edfef8 (unused test argument removed in f1f5fc677a)
- A lone path-effect node with one source turns about the source's center while the gesture orbits the effect's box (B): fixed f52f5155f8

Extra defects found while fixing:
- Group sizes its container through the base descriptor too, ignoring `forNode` (sweep): fixed 59ae35fc9e
- Nudge and Transform Again answer enabled with operands but no scene, while their `run` returns at once (sweep): fixed 8f481803e2, together with flip. One existing nudge test asserted `true` for that case; I dropped that line, and a new test asserts not applicable.
- Nudge and Transform Again (and through it `transformSelection`) also throw over an envelope with a locked source (sweep): fixed cc8f9e5787
- A swap drop commits through `swapOps` and threw on the same locked case (sweep): fixed cc8f9e5787. It now refuses the drop. The drop still arms over such a target: it shows the dwell preview, then commits nothing. Not fixed: arming would have to build the swap's ops on every hit-test.

The lock fix is one editing-internal helper, `packages/editing/src/actions/lockedWrites.ts`. `writesLocked` checks whether the ops an action would commit write a locked node, and `opsAnswer` turns that into `Locked`. Each command's `enabled` and `run` both read it. Rotate refuses to start in `captureTurn`, which also covers replaying a rotate through Transform Again. This follows the 2026-11-09 ruling, so nothing new went into `docs/unruled.md`.

Checks:
- Every new or changed test was seen to fail with the fix reverted and pass with it.
- Each touched test file, one at a time with `--maxWorkers=1`: pass. That is every file in the flip, align, distribute, swap, rotate, and transformAgain folders, the nudge tests, `edit/group.test.ts`, `pathfinder/booleanGroupAction.test.ts`, both lasso test files, all clone test files, and the new `lockedWrites.test.ts` and `rotate/rotate.derived.test.ts`.
- `npm run check:changesets`: pass ("OK — 2239 changeset(s)").
- `npm run check:size`: pass ("no file or function grew past its cap").
- `npx eslint` on every changed file by name: pass, after fixing one unused-argument error in a test.
- `npm run checks:gate`, `npm run typecheck`, `npm run typecheck:packages`, and `npm run lint -w @weasel-js/editing`: **unrun**. This session is on the controller machine, not a fleet node (the host is `Mac`). The Bash hook refuses suite-sized scripts and directory lint here, and says not to rephrase around it. So nothing has typechecked this branch, and the batch's gate has to cover typecheck and the full lint.

The tree is clean, and all 12 commits are on top of the frozen commit.