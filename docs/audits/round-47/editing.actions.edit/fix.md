Paint actions spread an `'inherit'` fill or stroke as an object, writing junk keys (A): fixed 8b339bb7e6

`setFillOpacity`/`setStrokeOpacity` write a NaN opacity (A): fixed 51b31cc1c9

`setStrokeWidth` writes a NaN, infinite or negative width (A): fixed d5aa97bfb7

`setVertexColor` splices an `rgba` of the wrong length or with non-finite channels (A): fixed 0cc4bc57ce

Paint actions and nudge act on page structure (B): fixed 285d204123. The paint actions really did paint a selected page and stayed enabled with only a page selected. Nudge already moved no page, because `moveNodesOps` drops pages through `translateTargets`. Only its gate was off: it said `NotApplicable` where `SelectionRequired` was meant. That is fixed in the same commit.

Paint actions stay enabled when a run would change nothing (A+B, the two reports' `setVertexColor` findings are one): fixed 20046374da for `setVertexColor`, which is now `NotApplicable` while no selected node has `vertexColors`. For the other paint actions I made a call and recorded it in `docs/unruled.md`. These actions are ongoing, and their params usually arrive with the drag's moves. If `enabled` judged the binding's params, a color-picker drag that starts on the current color would be refused before its first move. So they stay enabled, and a run that changes nothing still records no undo entry.

Group builds its container from a member's stored, parent-relative pose instead of its world pose, in the no-bounds fallback and the `fromBounds` template (B): fixed d8466692d9

Extra defects:
- `paintUnchanged.test.ts` passed the opacity actions an `opacity` param they never read: fixed in 51b31cc1c9 (now `alpha01`).

Checks:
- Every test file I touched, plus the existing tests for each changed action, run one at a time with `--maxWorkers=1`: pass. That is paintInherit, paintParams, paintUnchanged, pageStructure, setVertexColor, group.unbounded, setFill, setStroke, setFillOpacity, setStrokeOpacity, setStrokeWidth, nudge, nudge.subtree, group, group.frame, group.commonAncestor, group.marks and group.outermost. `paintActionTestUtils.ts` is a helper with no tests of its own. No browser test files were touched.
- `npm run checks:gate`: one full run, 30 of 32 passed, including root `npm run typecheck`, `typecheck:packages`, `check:size` and root `npm run lint`. Two failed:
  - `check:changesets`: three titles over 140 characters.
  - `check:proto-index`: a `parents[id]` lookup in `paintActionTestUtils.ts`.
- Both fixes were squashed into their commits. Then `npm run check:changesets`: pass. `npm run check:proto-index`: pass. `npx eslint` on `paintActionTestUtils.ts`: pass. paintInherit test: pass.
- Second full `checks:gate`: unrun. This machine's hook refused it ("suite-sized npm script, and this is the controller") and said to send it to the fleet, which the brief forbids. Since the first gate run, nothing changed except those two fixes.
- `npm run lint -w @weasel-js/editing`: unrun, refused by the same hook. `@weasel-js/editing` has no lint script of its own anyway. The root `npm run lint` inside the gate run passed.
- Tree is clean. Seven commits on top of dd66dc88c2, and `.skulk/` is untouched.