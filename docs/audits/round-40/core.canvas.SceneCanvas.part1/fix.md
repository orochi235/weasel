- Consumer `gestureSource`/`previewPoseExtra`/`boundsOfPose` override SceneCanvas's own (A): fixed 3c5ada3431. The three props are dropped from `SceneCanvasProps`. `canvasPassThrough` now also drops every other `<Canvas>` prop SceneCanvas sets itself, in case one arrives untyped. The changeset is `major` (`fix breaking`), because code that passes one of the three stops typechecking. I made that call myself and recorded it in `docs/unruled.md`.
- A preset's own tool and another preset's built tool with one id ignore `refines` (A+B): fixed edf939b1a2. Strict call, recorded in `docs/unruled.md`: two unrelated presets now throw.
- Inline `toolOptions` with an array or object field rebuilds every preset's tools each render (A): fixed d58cda2825.
- One painter at two priorities quietly keeps the first preset's (A): fixed 983ae1fd53. It now throws. The existing `nodeTraits.test.ts` case that expected the first priority to win was updated in the same commit. Strict call, recorded in `docs/unruled.md`.
- A `layers` slot field set to `undefined` erases the default `drawOne`, `paintBounds` or `handles` (A+B): fixed ccf80099c8.
- Preset `chromeRules` let the last preset win, the opposite of every other merge (B): fixed ebfe3e02b9. A refining preset's rule now wins. Strict call, recorded in `docs/unruled.md`: two unrelated presets now throw.
- Cursor and pick HUDs ignore a declared view under the pointer (B): fixed ab68be3129.
- Insert preview throws on an image overlay with no `extras` (B): fixed a50e8267af.

Extra defects found while fixing:
- `insertPreviewExtent` (sweep) had the same unguarded `extras` read for line, polygon, star and pencil: fixed a50e8267af, in the same commit as the insert-preview finding.
- The calls above are recorded in `docs/unruled.md` in 8c7b983091.

Checks:
- Every test file I touched, one at a time with `--maxWorkers=1`, all pass: `mergeLayers.test.ts` (2), `insertPreviewCommands.test.ts` (6), `insertPreviewExtent.test.ts` (4), `presetChromeRules.test.ts` (3), `presetShapes.test.ts` (2), `presetBuild.test.ts` (5), `canvasPassThrough.test.ts` (2), `SceneCanvas.huds.test.tsx` (9), `nodeTraits.test.ts` (7), `toolRegistry.test.ts` (17).
- Related files I didn't touch, all pass: `ownKeyLookups.test.ts` (9), editing `features.test.ts` (35), editing `CanvasView.test.tsx` (21).
- Each new test failed against the old code before its fix.
- `npm run checks:gate`: all 32 passed. The first run failed `typecheck` (a type error in my test) and `check:size` (`props.ts` at 402 lines); both were fixed and the rerun passed.
- `npm run check:changesets`: OK — 1900 changeset(s).
- `npm run lint -w @weasel-js/core`: fail — core has no `lint` script. I ran `npx eslint` on every changed file instead (pass), and the root `npm run lint` passed inside the gate.
- No browser tests were touched. The tree is clean.