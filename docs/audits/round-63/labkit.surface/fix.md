- Scroll inside a shadow root never reaches the document's scroll listener, so the tile lags a frame (A+B): fixed c1f0b5e01d
- Scope membership walks the DOM tree while clipping walks the flattened tree, so a slotted tile drops out of scope (A+B): fixed 2b160f1b6b
- Paint containment on `<body>` cuts tiles to the viewport (A): fixed e84d141ba4. f61853f6be's restructure already handled a paint-contained body. This commit also stops the body's overflow going to the viewport when the root or the body contains its paint, and reads the root's own padding box from its rect.
- A container resize that moves no tile delivers no frame, so buffers stay at the old size (B): fixed cfb35e5dc1
- A tile scrolled off a page where root and body clip nothing keeps its full `visible` rect (B): fixed f61853f6be. The viewport cut is skipped where the root has no client size (jsdom, or a frame with no layout).
- `overflow: clip` and paint containment ignore `overflow-clip-margin` (B): fixed 5a34d97d4e. It honors the margin's box and length; scroll containers still cut to the padding box.
- A `content-visibility: hidden` ancestor leaves a nonzero `visible` rect (B): fixed 993c695dfd

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1` (each file alone): `clip.test.tsx` 16 passed, `measureTiles.test.ts` 3 passed, `tiledSurface.test.ts` 7 passed, `useTiledSurface.test.tsx` 28 passed.
- The 8 labkit test files that reach the surface (`LabSurface`, `Lab.surface`, `Workspace.surface`, `Stage`, `Annotations.overlay`, `AnnotationOverlay.abandon`, `useLensDamage` and `index`): 8 files passed, 51 tests passed.
- No browser test files were touched.
- `npm run checks:gate`: "checks:gate: all 32 passed"
- `npm run lint -w @weasel-js/labkit`: pass
- `npm run check:changesets`: "[changesets] OK — 3216 changeset(s)."
- Tree clean.

tally: 7 of 7 fixed, 0 extra fixed