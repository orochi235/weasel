Two snapToContainer behaviors on one binding share one dwell state (A+B): fixed ae0a0a4ebf, plus baedc6278b, which keeps the new armed-swap state through `createPart` so the gate's part-cache check passes.

A root leaving a layout container moves its envelope members in the old frame (A+B): fixed 14d2aaabba.

A scrolled source container gets unscrolled bounds in the preview and scrolled bounds on release (A+B): fixed ec0c35e428. One `contentBoxOf` helper now gives the box to the source reflow, the release, and the drop candidate.

swapOnDrop swaps the selected node instead of the node the drag moves (A+B): fixed 71b4e94289.

The descendant carry, reflow carry, and source reflow's "did it move" test measure with the bare projection instead of each node's own descriptor (A): fixed 3ff4e93219. The same mistake was in `selectionCenter`, `catchGliding`, and `capturePlaneRefs`, fixed in the same commit.

A layer with a singular plane throws at press (A): fixed ce60f96edf, with a correction. The throw is real, but it comes from an identity plane map: `invertPlane` answers null for the identity, and the code asserted non-null. A zero-scale plane doesn't throw; its non-finite move is already skipped, and a regression test covers it.

A layout drop pulls a selected child out of its selected parent (B): fixed efab38466d. The same gap was in `snapToContainer`'s plant, the layout release's sources and exits, `rootTranslateOps`, and the pageDrop loop. All of them now use the session's outermost dragged ids.

An armed swap previews the layout insertion, but the release commits the swap (B): fixed 27472dc8f8. The drop previews stand down while a swap is armed. The documented rule that a later behavior's pose wins was left alone.

`moveLead` is cached by delta alone, so a landing that changes at the same delta is ignored (B): fixed a6e1a34a13.

Extra defect, found by the gate's typecheck: the new descriptor test used a node kind the scene doesn't declare. Fixed b8da69fbc1.

Extra defect, found by `check:changesets`: six of my changeset titles were over the 140-character cap. Fixed 55a2e46d9a.

No behavior call was needed, so `docs/unruled.md` is unchanged.

Checks:
- Each touched test file, one at a time with `npx vitest run --maxWorkers=1 <file>`: pass (descriptor 4/4, landing 3/3, layoutDropNested 1/1, layoutDropScrolledSource 1/1, layoutExitEnvelope 1/1, planeEdge 2/2, snapToContainerDwell 3/3, swapOnDrop 11/11, swapOverLayout 1/1). Neighboring move tests also pass, including move.test 22/22, move.pages 26/26, and move.lifecycle 21/21.
- `npm run checks:gate`: "checks:gate: all 32 passed", after fixing the typecheck and check:part-caches failures from the first run.
- `npm run check:changesets`: "[changesets] OK — 2239 changeset(s)."
- `npm run check:size`: "sizes: no file or function grew past its cap."
- `npm run lint -w @weasel-js/editing`: unrun. The hook refused it as a suite-sized npm script on the controller, and `packages/editing/package.json` has no `lint` script anyway. Instead, `npx eslint` on all 28 changed files: pass (exit 0, no output).
- Tree clean: nothing uncommitted, and `.skulk/` untouched.