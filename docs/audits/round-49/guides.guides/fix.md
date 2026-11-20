matchSpacing still counts a gap the snap carried the box into (A): fixed 869610c8b8. The same mistake was in `spacingSnapSource`'s marks and hold check (`packages/guides/src/sources/spacing.ts`), fixed in the same commit with its own test. Placements are still only offered from gaps the box clears where it starts, because an existing test expects that. A's other point, that a gap the box leaves should now be offered, is not done.

Add and replace guide ops that change nothing still record an undo step (A+B): fixed b049f7ce92. `sameGuide` moved out of `useGuides` into `sameGuide.ts`, so the store and the ops use one definition.

Spacing tolerance of 1e-6 is absolute, and the 1e-3 and 1e-6 tolerances disagree (A): not a defect. `docs/unruled.md` has an open entry dated 2026-11-11 saying the alignment and spacing tolerances are world lengths, not relative ones, and that whether they should scale is undecided.

`siblingBounds` and `worldBoundsOf` ignore parallax planes (B): fixed 5cdc94f5ef. `SceneBoundsOptions` now takes `planeOf`, keyed by node id, matching `deriveAlignmentGuides`. It is new API, so its changeset is `minor`.

No extra defects.

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file: pass. That is `alignment/spacing.test.ts` (21), `sources/spacing.test.ts` (14), `ops.test.ts` (3), `alignment/sceneBounds.test.ts` (5), `ops.shrunk.test.ts` (4), `ops.pbt.test.ts` (1), `useGuides.test.ts` (11), `useGuides.pbt.test.ts` (4), `alignment/spacing.pbt.test.ts` (8), `alignment/edges.pbt.test.ts` (5), `alignment/edges.shrunk.test.ts` (4), and `sources/spacing.shrunk.test.ts` (2).
- `npm run check:changesets`: pass.
- `npm run check:size`: pass.
- eslint on all ten changed files: pass.
- `npm run checks:gate`: **unrun**. A PreToolUse hook refused it as a suite-sized script on the controller machine, not a fleet node, and the brief forbids fleet runs.
- `npm run lint -w @weasel-js/guides`: **unrun**, refused by the same hook.
- `npm run typecheck:packages -- guides`: **unrun**, refused by the same hook. The batch's gate has to cover the root typecheck and the guides lint.

The tree is clean apart from `.skulk/`.

tally: 3 of 5 fixed, 0 extra fixed