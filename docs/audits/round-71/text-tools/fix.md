Greek bars keep a container's old inherited fill (A+B): fixed 6fe2017362

Greek bars ignore `verticalAlign`, `fit` and `overflow: 'clip'` (A+B): fixed b31048de7f

Greek rung drops a background's shadow and edge (A): fixed 5b9c07f362. Both rungs now draw the backdrop through one function, `textBackdropOf` in `textFrame.ts`.

Double-click won't open a visible overflowing line that selection picks (A): not a defect. Selection doesn't pick that line either: `scenePointQuery.ts:40` admits a point only inside the pose rect, then narrows it to the silhouette, and `textPainter.overflow.test.ts`'s `shapeCoversPoint` case tests only that narrowing step. Both paths agree on the pose box. A trial fix that accepted line boxes in `textHitAt` also broke `textHitAt.index.test.ts`, because the pick index boxes text by its pose rect, so I reverted it.

`enterTextEdit` / `isTextNode` open a locked node and its edit is lost (A): fixed 74e79dc3bf. `isTextNode` now answers false for a locked node, and `startEdit` refuses one; this has a patch changeset. The scene's own selection drops locked nodes, but a selection the consumer keeps outside the scene and a direct `startEdit` call could still reach one.

The three greek-rung fixes have no changesets because the rung itself has not been released yet: its `minor` changeset is still pending.

Extra: none.

Checks:
- `npx vitest run --maxWorkers=1 packages/text-tools/src/node/textLadder.test.ts`: pass (8)
- `npx vitest run --maxWorkers=1 packages/text-tools/src/editor/useSceneTextEdit.test.ts`: pass (29)
- Also run, without changes to the test files: `textPainter.*.test.ts` and `textFrame.test.ts` pass, `useSceneTextEdit.{box,draft,frame}.test.ts` pass, `enterTextEdit.test.ts` passes, `canvasEditor.test.tsx` passes, `textHitAt.test.ts` and `textHitAt.index.test.ts` pass on the reverted tree.
- `npm run checks:gate`: pass ("all 33 passed")
- `npm run check:changesets`: pass
- `npm run lint -w @weasel-js/text-tools`: fail, because the package has no `lint` script. I ran `npx eslint` on every changed file instead: pass.

tally: 4 of 5 fixed, 0 extra fixed