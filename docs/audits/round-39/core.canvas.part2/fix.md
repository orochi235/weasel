pixelPickEvery returns unsorted hits when a later pass can't read (A+B): fixed e47f641c4b

createCanvasReader opens a WebGL2 context before the canvas has a backend (A+B): fixed 29e7444204. It now answers null until the canvas's first renderer is built. Three hud loupe test files used bare canvases with no renderer, so they now record a backend through a new `rememberBackend` export in `@weasel-js/core/testing/canvas`.

useStandInLayers reads the ref during render, so a canvas mounting under a stand-in already shown never applies it (A+B): fixed 8701aac31c. It reads again after commit, and only re-renders when that read could come out differently, so a SceneCanvas mount costs no extra render in the common case.

Layer sampler renders with no view matrix, so `units: 'world'` gradients are sampled in screen space (A): fixed e7d551c817. The plan now carries `view` (world → raster pixels), and `RasterSession.renderCommands` takes a `view` option. That is new API, so it has its own `minor` changeset.

renderDebugSnapshot at `pixelRatio` > 1 draws `{ px }` lengths at a fraction of their size (A): fixed d4bec7aad5. `renderSceneToPixels` and `planPixelRender` take a new `pixelRatio`, with its own `minor` changeset. I made the strict call and recorded it in `docs/unruled.md`: `'screen'` units are measured in CSS px at that ratio, and a ratio that is not a positive finite number throws.

An adopted pick id still on the free list gets handed to a second node (A): fixed b072c75060

A copy that includes a page drops the hidden sources of a derived node on that page (B): fixed 9ff9f14842

A drop-point paste measures its cluster origin from edges' placeholder poses (B): fixed 48de20b6eb

Extra defects found while fixing: none. 3b9644f276 only shortens the eight changeset titles above to the 140-character cap that `check:changesets` enforces.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: all pass
  - layerSample.test.ts: 5 passed (5)
  - paintStandIns.test.tsx: 5 passed (5) (renamed from .test.ts)
  - pixelPick.test.ts: 1 passed (1) (new)
  - readback.test.ts: 6 passed (6)
  - renderDebugSnapshot.test.ts: 2 passed (2) (new)
  - sceneClipboard.test.ts: 2 passed (2) (new)
  - scenePickIds.test.ts: 10 passed (10)
  - hud createLoupe.exact.test.ts: 2 passed (2)
  - hud createLoupe.parked.test.ts: 5 passed (5)
  - hud createLoupe.test.ts: 21 passed (21)
- Untouched neighbors, also passing: createLoupe.interactive, derivedPath, editing's sceneAdapter.clipboard.derived, the sceneAdapter clipboard landing, frame, pasteDescriptor and main tests, pasteAt, weaselJsonHandler, clipboardOps, paste.pages, renderSceneToPixels, warmRender, and the export package (42 passed).
- Unrun: `renderDebugSnapshot.browser.test.ts` is a browser test and cannot run here. I didn't edit it, but the `pixelRatio` change affects what it renders, so it needs the fleet run.
- `npm run typecheck:packages -- core hud`: core ok, hud ok
- eslint on every changed .ts/.tsx file: exit 0
- `npm run check:size`: "sizes: no file or function grew past its cap."
- `npm run check:changesets`: "[changesets] OK — 1833 changeset(s)."
- Tree is clean, and `.skulk/` is in no commit.