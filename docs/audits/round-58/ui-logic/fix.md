- Current menu row measured at weight 400 though the DOM draws it bold (A+B, two findings): fixed b7c332f440
- `nestHold` keeps an outer hold's reason while that hold is off (A): fixed 682c8f7d6d
- `controlAccess` counts an empty reason as a reason (A): fixed bc8abc94a9
- Empty row-list state measured upright though `ItemList` sets it in italic (A+B, two findings): fixed add3335fb8
- `runs()` accepts a fractional or infinite `WEASEL_PBT_RUNS` (A): fixed f4afff640f. No changeset because it is a test-only fixture. The same `runs()` sits in other packages' `pbt.fixture.ts` files (animator, audio, bidi, clock, and others) and in `apps/forge/fonts.pbt.test.ts`. Those are outside this area and I left them alone.
- `measureButton` shrinks the label to any width, but the DOM label can't go below its min-content (B): fixed 89b4cf18bc. I changed the DOM to match the measure, which is also how the HUD button behaves. The label now has `min-width: 0`, `white-space: nowrap`, `overflow-x: clip` and `text-overflow: ellipsis`. The link variant still wraps (`white-space: normal`).
- `envNumber` reads a value like `150%` or `18px` as a multiplier (B): fixed 3d4fe0fc76

Things to know about the fixes:
- **New API:** the bold-row and italic fixes add public surface, so their changesets are `minor`, as `check:changesets` requires for the `api` tag. The additions are `MenuRowFace.current`, `MenuPanelMetrics.currentFont`, `FontSpec.style`, and `RowListMetrics.emptyFont`. `createDomMeasureEnv` now passes the style through, and hud's `menuFace` passes `current`.
- **Button label not checked in a browser:** the label's on-screen behavior has only a CSS-text test that ran here. I added a layout test for it to `packages/ui/src/components/measure.browser.test.tsx`, but browser tests can't run here, so it is **unrun**.

Checks:
- Each touched test file run on its own with `--maxWorkers=1`, all pass: `hold.test.ts` 9/9, `pbt.fixture.test.ts` 2/2, `measure.test.ts` 5/5, `menuPanel.test.ts` 7/7, `rowList.test.ts` 7/7, hud `panelCommands.test.ts` 11/11, ui `createDomMeasureEnv.test.ts` 1/1, `Button.test.tsx` 31/31. Related property and CSS tests also pass: `rowList.pbt` 2/2, `button.pbt` 4/4, `menuGeometry.pbt` 6/6, `menuPanelCss` 4/4.
- `npm run checks:gate`: pass, "all 32 passed". The first run failed `check:changesets` on two titles over 140 characters; I shortened them and folded the fixes into their commits.
- `npm run lint -w` for ui-logic, ui, and hud: none of the three has a `lint` script ("Missing script"). eslint on the changed files: pass.
- `npm run typecheck:packages -- ui-logic ui hud`: pass.
- `check:size`: pass. `check:test-projects`: pass.
- The tree is clean.

tally: 9 of 9 fixed, 0 extra fixed