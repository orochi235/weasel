Translucent fill opacity stuck after alpha to 100% (A) — not a defect (the bar's opacity slider commits `#ff0000ff` at 100%, and `paintWithColor` counts a hex alpha as the color's own, so the fill comes out opaque; confirmed by driving the real slider in a test)

No fill toggle shows off instead of mixed over a mixed fill (A+B) — fixed d5e04e8f05 (strict call recorded in `docs/unruled.md`: a `RangeStyle` can't tell a two-color range from a partly unfilled one, so the toggle shows mixed for any mixed fill; this replaces an existing test that pinned it as off)

Top-level layer-list drop picks its parent from the first dragged row only (A) — fixed 4606c9f581

Children of an annotation group can never be reordered (B) — fixed 25e41401af (`onReorder` also miscounted the drop gap inside such a group; the same commit fixes that)

Editing one field of `units` (or `clip`) on a node that has none writes a partial value (B) — fixed 566d7e56fe (strict call recorded in `docs/unruled.md`: the node is left unchanged and a warning is logged in dev; `NodeClip` is the string `'outline'`, so no `clip.<field>` leaf exists, and the same guard covers it anyway)

Extra: none. c532b1929e only moves `topParent` out of the hook, which the fixes above had pushed past `check:size`'s 120-line limit for a function.

Checks:
- `npx vitest run --maxWorkers=1 packages/ui-canvas/src/components/inspector/CharacterOptions/CharacterOptions.test.tsx` — pass (35 passed)
- `npx vitest run --maxWorkers=1 packages/ui-canvas/src/components/SceneLayerList/useSceneLayerList.test.tsx` — pass (27 passed)
- `npx vitest run --maxWorkers=1 packages/ui-canvas/src/components/inspector/SelectionPanel/commitLeaf.test.ts` — pass (7 passed)
- SelectionPanel `units`, `clip`, `reset`, and `objectLeaf` tests (unchanged, run as a regression check) — pass
- `npm run checks:gate` — pass ("checks:gate: all 33 passed")
- `npm run lint -w @weasel-js/ui-canvas` — not run: the package has no `lint` script. `npx eslint` on every changed `.ts`/`.tsx` file passes (exit 0)
- No browser test touched

tally: 4 of 5 fixed, 0 extra fixed