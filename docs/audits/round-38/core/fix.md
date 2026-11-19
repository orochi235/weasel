Paint ignores a region's own `chromeId` while the hit test honors it (A+B) — fixed 119b620c26
Escape returns to a default tool the active mode bars (A) — fixed 3822ec3876
Overlapping point regions ranked by world distance, not screen distance (A) — fixed 53bc3f339f
Annulus paint and `minBandPx` floor assume the cutout is centered on (cx, cy), while the hit test uses its real position (A+B) — fixed ccc89934cd (floor, which hit and paint share) and 1cbb8a8f49 (paint)
Annulus petals wind against each other, leaving corner holes under nonzero fill and drawing chords across the band with a stroke (B) — fixed 1cbb8a8f49. It is one rewrite with the finding above: the fill is now the ring split into disjoint pieces around the real cutout, and the stroke is a separate command tracing only the ring's outline
A `KeyState` attached to two targets loses its window-blur release when either detaches (B) — fixed ca5e6f7bca. The detach's `release()` still clears keys the other attachment holds; the `attach` doc promises "the detach, which also releases", so I left that as documented
`usePublishPointer` keeps a stale position after a release off the window that the document never sees (B) — fixed 168e79354a
A composed layer's hit drops the region's `hitKind`, so the `docs/extending.md` example's `handle:` predicate never matches (B) — fixed df92007189. The defect was the example: `AffordanceRegion.hitKind` already documents that inside a consumer-registered layer the layer id is the discriminator, so the example now matches `layer:my-tool-overlay` and reads the corner from `payload`. Docs only, so no test or changeset; `cornerResize.test.ts` already checks that the scratch reaches the hit
`useKeyState({ target })` never attaches if the element mounts after the first effect (B) — fixed 3883c0e2ac

Extra defects found while fixing:
`usePublishPointer` reads its element ref once at mount, the same mistake as `useKeyState` — fixed 3883c0e2ac, through a shared `useAttach` helper that re-resolves the element after every commit without an extra render

No new `docs/unruled.md` entries: none of these needed a behavior call nobody had made.

Checks run (from the tree root):
- `npx vitest run --maxWorkers=1 packages/core/src/affordances/composeAffordanceLayer.test.ts` — pass (26)
- `npx vitest run --maxWorkers=1 packages/core/src/affordances/hitAffordanceRegions.test.ts` — pass (23)
- `npx vitest run --maxWorkers=1 packages/core/src/input/keyState.test.ts` — pass (17)
- `npx vitest run --maxWorkers=1 packages/core/src/input/useKeyState.test.tsx` — pass (3)
- `npx vitest run --maxWorkers=1 packages/core/src/input/usePublishPointer.test.tsx` — pass (8)
- `npx vitest run --maxWorkers=1 packages/core/src/tools/useKeybindings.test.ts` — pass (22)
- Neighboring files the changes reach, untouched, each alone: `editing` `rotationHandle.test.ts` (18), `overlay.test.ts` (38), `overlay.transform.test.ts` (6); `core` `PointerPublisher.test.tsx` (3), `SceneCanvas.clientToWorld.test.tsx` (4); `minimap.test.tsx` (16); `SceneCanvas.alignReference.test.tsx` (1); `usePenTool.rubberBand.test.tsx` (3) — all pass
- `npm run typecheck:packages -- core` — `1/1 core ok`
- eslint on every changed `.ts`/`.tsx` file — pass (exit 0)
- `npm run check:size` — `sizes: no file or function grew past its cap.`
- `npm run check:changesets` — `[changesets] OK — 1738 changeset(s).`
- No browser test files touched. Tree is clean apart from `.skulk/`, which is left alone and out of every commit.