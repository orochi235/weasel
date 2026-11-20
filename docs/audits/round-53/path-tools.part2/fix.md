Shape Builder planning over operands (A) — fixed 869a982be6 (with a follow-up changeset fix bad6efec4f)
"Make segments straight/curved" variants stay enabled when they would change nothing (A+B) — fixed 99b4bd25bc
Sand's preview ignores a tolerance change mid-stroke (A) — fixed 385ae0ebdd
withOutlines' `Object.create` retry wrapper breaks adapters with private fields (A) — fixed a44c3d125d
A node deleted while Create Outlines waits stays in the selection, and `from` is stale (B) — fixed a44c3d125d (same commit as the one above: passing explicit ids replaced the wrapper that caused both)
withOutlines leaves an unhandled rejection and no notice when load() rejects (A) — fixed 392225794f
createOutlines and outlineStroke check `operands` but convert the adapter's selection (A) — fixed d19cdf45a5
Stale `foundHidden` after Set Path, Set Spine or Release Spine (A) — not a defect: core's `scene.setDependsOn` already moves `foundHidden` by source id through `foundHiddenRetargeted`, so the replaced source's position is dropped. A probe assertion that `sourcesHiddenBy` includes the new visible spine after Set Spine passed, so I reverted it.
Stale `foundHidden` on retarget (B) — duplicate of A's stale-`foundHidden` finding
Reach outside path edit drops per-anchor widths and colors (B) — fixed bb0bd45a4b
Shape Builder's plan cache ignores stacking order (B) — fixed 69e212fa56
`convertSegments`' enabled check ignores the variant's `to` (B) — duplicate of A's convertSegments finding

Extra: the text-tools outline test fixture's `getNode` answered undefined for every id, which the retry's deleted-node filter now reads — fixed b6c00f3d1e-style follow-up commit "give the text-tools outline test adapter the nodes it converts, which the outline retry now checks" (HEAD). This fixed a fixture, not a product defect, so it is not counted as an extra.

Notes: resample and simplify also call `reshapeOps` without anchor data, but they refit whole paths and have no origins to carry, so the Reach fix does not apply to them. The new optional `ids` parameters (`runCreateOutlines`, `applyOutlineStroke`, `planShapeBuilder`, editing's `resolveBooleanOperands`) have `api`-tagged `minor` changesets. No finding needed a behavior call, so `docs/unruled.md` is unchanged.

Checks:
- `npx vitest run --maxWorkers=1` on each touched file: segmentType/convertSegments.test.ts pass; reach/reachToMeet.test.ts pass; outlines/createOutlinesAction.test.ts pass, plus the outlines/ directory (35) pass; shapeBuilder/useShapeBuilderTool.test.tsx pass, plus the shapeBuilder/ directory pass; sand/sand.test.ts pass; text-tools textOutline.createOutlinesAction.test.ts pass (7); textOutline.outlineStroke.test.ts pass; pathToolsTools.canvas.test.tsx pass; editing/src/booleans pass (47); pathEffects/spine.test.ts pass (unchanged).
- Each new test failed before its fix and passed after.
- `npm run check:changesets`: pass.
- `npm run checks:gate` on the final tip: pass ("checks:gate: all 32 passed").
- `npm run lint -w` path-tools / editing / text-tools: unrun, because none of these packages has a `lint` script ("Missing script: lint"). The root `npm run lint` inside the gate passed.
- No browser tests were touched. The tree is clean apart from `.skulk/`.

tally: 9 of 12 fixed, 0 extra fixed