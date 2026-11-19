fixed 648da874d4 | The preview ghost painted hidden children of a dragged container, and children on hidden layers (A+B)
fixed 648da874d4 | The departure ghost painted a removed node that is `hidden`, and its subtree (A+B)
fixed 2423fdd39d | The preview and departure ghosts ignored the scene slot's `drawnPose`, so they painted off the quantize grid (B)
fixed 479a309d52 | The worker decided whether the page builds the scene, and read `cull`, from the raw `layers.scene` prop instead of the slot resolved with presets (A)
fixed f915f51c02 | When `viewport.zoom`/`pan`/`touchZoom` re-registered, it buried a merged `actions` override (A)
fixed f915f51c02 | The `actions` prop missed actions owned by tools and contributions, because they register after the resolver runs (B). Only the partial-merge half of this was real. The resolver now re-applies on registry changes, and its "no default" warning waits until the commit's effects have run, so it no longer fires for an action registered later in the same commit. Not a defect: the claim that `actions={null}` should also mute tool and preset actions. `SceneCanvas.actions.test.tsx` asserts on purpose that null spares them ("opts out of the kit's defaults, not out of the presets you passed").
fixed 9c0b73d0ff | Content bounds were cached on `getVersion()`, which pose overrides and scroll offsets don't bump (A)
fixed 291f13dc01 | `colorAt` ignored `layerOrder`, so it sampled layers left out of the paint and stacked them in the wrong order (A+B)
fixed b00c67076e | Hover was only tracked when the `chromeVisibility` prop or `onHover` was given (B)
fixed 0b75978b14 | `useBakedScene` returned a later `SerializedScene` prop cast as a live `Scene`, which threw on first use (A+B). I made a strict call here and recorded it in `docs/unruled.md`: the canvas keeps the last live scene and warns once.

No extra defects found while fixing.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: pass. Files: `useActionsPropResolver.test.tsx` (4), `useBakedScene.test.ts` (2), `useContentBounds.test.ts` (3), `useDepartureGhostLayer.test.tsx` (7), `usePreviewGhostLayer.test.tsx` (2), `useSceneChrome.test.tsx` (1), `useSceneWorkerSurface.test.ts` (5), `layerSample.test.ts` (5). Each new test failed against the frozen source before its fix.
- The resolver change touches existing `actions`-prop tests, so I also ran every editing/core test file that sets that prop: pass. Files: `ViewMarker.drag`, `SceneCanvas.actions`, `CanvasView`, `kitTools.walk`, `SceneCanvas.smoke`, `.actionScopes`, `.modes`, `.features`, `.tools`, `.actions.behavior`, `.useSelectTool.integration`, `.heldModifiers`.
- `npm run typecheck:packages -- core`: pass ("1/1 core ok")
- eslint on the changed files: pass
- `npm run check:size`: pass ("sizes: no file or function grew past its cap.")
- `npm run check:changesets`: pass ("[changesets] OK — 1831 changeset(s).")
- No browser tests touched. The tree is clean, and `.skulk/` was left out of every commit.