- Annotation pick swallows a multi-select change and never unpicks (A+B): fixed 1a4abcbd35
- "No fill" shows plainly off, not mixed, when the fill is MIXED between none and a color (A): question. `RangeStyle` gives the same `fill: MIXED` for none-plus-red as for red-plus-blue, so `CharacterOptions` can't tell the two apart. Marking `noFill` mixed on every MIXED would mislabel red-plus-blue, and an existing test deliberately keeps it unlit there. A fix needs `@weasel-js/text`'s range style to report whether some of the runs have no fill.
- PlotDataPanel keeps an edit's error after `data` changes from outside, and catches the host's `onChange` errors (A): fixed 4e8a455b05
- AnchorFields' SeveralAnchors story stand-in sets a Mixed X to 10 on `+=10` (A): fixed 0b1ada21f1 (story only, so no changeset or test)
- Annotation pick swallows a multi-select change and never unpicks (B): duplicate of the first finding (A)
- SceneGradientHandles commits `nodeId`'s gradient to the selection's nodes (B): fixed 804ab1ac6d (the paint actions take an `ids` param) and 4e3c8dfc61 (the handles pass `ids: [nodeId]`)
- A SelectionPanel draft that ends in a cancel stays in the scene (B): fixed 508c6c1e16. On a single value the claim is wrong: the kit's edit protocol sends the start value back through `onInput` before `onCancel`, so the draft is already undone, and a slider test I wrote passed before the fix too. Over a mixed selection it is a real defect: that one start value was drafted onto every node and stayed there. Drafts now carry a `cancel` (`LeafContext.drafts.cancel`, a `cancel` argument to `withDrafts`, `PanelCellScope.cancel`, `LeafWrites.cancel`) that puts each node back to its own value. Only kit settings that leave text, number or color fields live on a panel can reach this; with the defaults, only sliders draft, and a slider is disabled over a mixed selection.
- PlotDataPanel can't unset an optional color or boolean field (B): question. `@weasel-js/ui`'s color and boolean controls have no unset state; number and enum get theirs from `onClear`. Adding one means designing a clear control for a color swatch and a third state for a boolean, which is a UI decision outside this area.
- CharacterOptions drops a solid fill's `opacity` (B): fixed 6a671f233c. The swatch now includes the opacity in its color, and a color edit keeps it (through `paintWithColor`). Side effect: a picked `#00ff00ff` now commits as `#00ff00`, and the existing test was updated for that.

No extra defects found.

Checks:
- `npm run checks:gate`: all 32 passed. The earlier runs failed on four over-long changeset titles, a TS2339 in `createPaintAction.ts`, and then `check:proto-index` on the same line. Each was fixed and folded into its commit with a non-interactive `--autosquash` rebase of my own commits, which ends at the frozen commit.
- `npm run typecheck`: pass. `npm run typecheck:packages -- editing ui ui-canvas core`: pass.
- `npm run lint -w` for ui, ui-canvas, editing and core: none of these packages has a `lint` script ("Missing script"). `npx eslint` on every changed file: pass. The root `npm run lint` passed inside the gate.
- Each touched test file run alone with `--maxWorkers=1`: `paintTargets.test.ts` 2 passed; `PlotDataPanel.test.tsx` 7 passed; `SceneGradientHandles.test.tsx` 10 passed; `useSceneLayerList.test.tsx` 25 passed; `CharacterOptions.test.tsx` 34 passed; `commitLeaf.test.ts` 6 passed; `commitPolicy.test.ts` 11 passed. The neighboring `setFill.test.ts` (20) and `pageStructure.test.ts` (4) also passed.
- Every new test except the two `cancel` unit tests was confirmed failing against the old sources. Those two call new API that didn't exist before.
- Tree clean.

tally: 6 of 9 fixed, 0 extra fixed