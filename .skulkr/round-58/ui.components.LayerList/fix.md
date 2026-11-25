rename field reopening when its row stops being renamable (A+B) — fixed eb73d1b7b4
locked layer's children can be moved out, renamed and removed (A+B) — fixed 190e9ab27b
layer with empty `children` drawn as a leaf, so nothing can be dropped back in (A) — fixed 8fa859e6dc
empty remove slot ignores `--wzl-button-h` (A) — fixed f40aea3d4a
untouched rename on a label with surrounding spaces reports a rename (B) — fixed 4516626d7f
uncontrolled fold map keeps toggled ids forever (B) — not a defect (it holds one entry per distinct layer the user folded by hand, so it grows only with user clicks; keeping a removed layer's entry is what lets a layer restored by undo come back folded as it was)
`moveLayers` silently drops moved layers when the parent is missing or among them (B) — fixed 5f39ef6115. This was a strict call (it now throws), recorded in `docs/unruled.md`.
Locked-children finding, as B listed it (B) — duplicate of the locked-children fix above (190e9ab27b)
Rename finding, as B listed it (B) — duplicate of the rename fix above (eb73d1b7b4)

Extra: none. In the same commit as the slot fix, I moved a misplaced "lock column" CSS comment back to `.lockToggle`. That isn't a defect.

Checks:
- `npx vitest run --maxWorkers=1 packages/ui/src/components/LayerList/LayerList.test.tsx` — pass (42 passed)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/LayerList/LayerList.keyboard.test.tsx` — pass (21 passed)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/LayerList/LayerList.render.test.tsx` and `LayerList.hold.test.tsx` — pass (3 and 5 passed), run mid-work; neither file was edited
- `npx vitest run --maxWorkers=1 packages/ui-canvas/src/components/SceneLayerList/useSceneLayerList.test.tsx` — pass (23 passed), run mid-work as a consumer check; not edited
- `packages/ui/src/components/LayerList/LayerList.browser.test.tsx` — unrun (browser test, can't run here)
- `npm run check:changesets` — pass (OK, 3027 changesets)
- `npm run checks:gate` — pass ("checks:gate: all 32 passed")
- `npm run lint -w @weasel-js/ui` — not run: `@weasel-js/ui` has no `lint` script (npm prints its missing-script error and the script list). The gate's root `npm run lint` passed.

The tree is clean.

tally: 8 of 9 fixed, 0 extra fixed