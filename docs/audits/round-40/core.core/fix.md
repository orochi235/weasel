Fixed: `legalSelection` stale memo (A+B), `fixed 0f1b430c7d`

Fixed: a layer group's throwing `effects` thunk losing the frame (B), `fixed 3d7f5e8758`

Fixed: a layer named twice in `layerOrder` painting twice (A), `fixed 27225a58a4`. The same mistake sat in `paintedSceneLayers` and the worker stack's `orderedIds`, and both are fixed too. Strict call recorded in `docs/unruled.md`: the layer draws once, at its first place, and warns in development.

Fixed: `warnLayersOnce` dedupe set growing without bound (A), `fixed 4c48db29c1`. It is now capped at 256 messages, oldest out first. No changeset, since this is dev-only.

Fixed: `usePointerStylus` `hovering` never true with the default `window` target (A+B), `fixed 3563a449b2`. The old test dispatched `pointerenter` to `window`, which a browser never does, so it was corrected along with the hook.

Fixed: `usePointerStylus` resolving a ref once (A+B), `fixed d3f3a34f27`, plus `8337d4747e`, which rewrote it to pass `react-hooks` lint. Strict call recorded in `docs/unruled.md`: an empty ref listens to nothing instead of falling back to `window`.

Fixed: `stableStringify` returning `undefined` under a `string` type (A), `fixed 2a4d33080a`. It now returns the bare word `undefined`, and forge's `coverOf` no longer needs its `?? ' undefined'` guard.

Fixed: `stableStringify` tags colliding with real objects (A), `fixed b0960cc36c`. Strict call recorded in `docs/unruled.md`: an object with its own `$type` key is written as `{"$type":"object","value":…}`.

Fixed: `usePublishSceneSelection` keeping stale kind labels after an in-place edit (B), `fixed a902f95185`. The labels now come from `useSyncExternalStore` on the scene.

Extra: shortened four changeset titles to under 140 characters, `fixed af8342fb47`.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: pass for all ten files touched or exercised.
  - `legalSelection.test.ts`: 6 passed
  - `render.test.ts`: 47 passed
  - `sceneLayerPaint.test.ts`: 1 passed
  - `usePointerStylus.test.tsx`: 9 passed
  - `teardown.test.tsx`: 27 passed
  - `stableStringify.test.ts`: 7 passed
  - `stableStringify.pbt.test.ts`: 3 passed
  - `stableStringify.shrunk.test.ts`: 2 passed
  - `SceneCanvas.selectionKinds.test.tsx`: 6 passed
  - forge `preview-api.test.tsx`: 15 passed
- `npm run checks:gate`: pass ("checks:gate: all 32 passed"). The first run failed on `check:changesets` (title length) and `lint` (`usePointerStylus`); both were fixed before this rerun.
- `npm run check:changesets`: pass ("OK — 1900 changeset(s)").
- `npm run lint -w @weasel-js/core`, `-w @weasel-js/editing`, and `-w @weasel-js/forge`: unrun. None of these packages has a `lint` script ("Missing script: \"lint\""). The root `npm run lint` inside the gate passed and covers them.
- No `*.browser.test.*` files were touched. The tree is clean apart from `.skulk/`.