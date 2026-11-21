- Lasso reads as a click in world units, so a lasso drawn zoomed in or a long thin one clears the selection (A+B): fixed 887276ce78. The click test and the vertex spacing are now in screen px. A sliver long on one axis is hit-tested, as the marquee does. I also reworded yesterday's pending `lasso-sliver-reads-as-click` changeset, because it now overstated what counts as a click.
- Cut deletes the operands but copies the clipboard's own selection; Copy has the same split (A+B): fixed 444ec75c56. `ClipboardDep.copy(ids?)` is new API, so the changeset is `minor`. `apps/draw`'s wrapped dep now passes the ids through.
- Make Boolean Group doesn't re-express an envelope operand's children, so they jump (A): fixed 6b15db553a. Swap's `reframed` moved to a shared `actions/reframed.ts`, and swap uses it from there.
- `useAlign`/`useDistribute` write `setPose` on a derived-pose node, so it doesn't move (A): fixed e421eb4ba6, when the hook is given `scene`. The finding's side point, that the hooks skip the actions' lock and page-structure filters, I did not change: the hooks only see an adapter and a `DrawnBoundsScene`, which has no lock reader.
- Reorder reports enabled with no `scene` dep (A): fixed 93e4a8ed15.
- Copy and Cut report enabled with no `clipboard` dep (A): fixed c2f55d951c.
- Pathfinder actions check `operands` in `enabled` but combine the adapter's selection (B): fixed c9bc472f92. `applyBooleanOp`/`previewBooleanOp` take optional `ids`; the changeset is `minor`.
- Rotate with `pivot: 'each'` takes a selected derived-pose group apart, unlike Flip (B): fixed 8ba2979693.

Extra:
- Group (Cmd+G) had the same envelope-children jump as Make Boolean Group (sweep, `edit/group.ts`, which is outside the listed files): fixed 0c12ef53b4. One assertion in `group.test.ts` changed: a member whose pose doesn't change no longer gets a no-op transform op.

Checks:
- Each touched test file, run one at a time with `--maxWorkers=1`: pass. Every new test was also seen failing on the old source. Files: `lassoSelect.test.ts`, `selectFromLasso.test.ts`, `clipboard.test.ts`, `clipboardOps.test.tsx`, `reorder.test.ts`, `pathfinder/action.test.ts`, `booleanGroupAction.test.ts`, `group.frame.test.ts`, `group.test.ts`, `align.stroke.test.ts`, `rotate.derived.test.ts`.
- Neighbors of the changed code, same way: pass. Files: swap, booleans, the other `group*`, `align.test.ts`, `distribute.test.ts`, `distribute.stroke.test.ts`, `rotate*`, `useLassoTool.test.tsx`.
- `npm run checks:gate`: pass ("checks:gate: all 32 passed"). The first run failed `typecheck` and `typecheck:packages` on a `NodeId` type in rotate/session.ts; fixed and amended into 8ba2979693.
- `npm run check:changesets`: pass.
- `npm run lint -w <pkg>`: not run. `@weasel-js/editing` and `@weasel-js/core` have no `lint` script ("Missing script"), and `apps/draw` is not a workspace. Instead, eslint on every changed .ts/.tsx file: pass.
- Unrun: `clipboardOps.browser.test.tsx` is related to the clipboard change but needs a GUI node.

The tree is clean.

tally: 8 of 8 fixed, 1 extra fixed