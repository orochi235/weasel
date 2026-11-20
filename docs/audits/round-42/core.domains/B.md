I couldn't write `.skulk/out/findings.md`: both the Write tool and shell redirection needed approval, so the whole document is below. Two notes on the setup. The frozen commit `a31056c5…` doesn't exist in this repo, so I reviewed the checked-out HEAD (`782733b19c`). I also left out one finding I couldn't confirm: `enteredGroupScope` may dim the boolean group that draws a group entered inside it.

# Audit round 42 — core.domains findings

## resolveVisibility looks chrome ids up through the prototype chain
- where: packages/core/src/domains/chrome-caps/resolve.ts:19 (resolveVisibility)
- scenario: `ChromeId` is open (`string & {}`), so a consumer can gate its own id, for example `hasOwnProperty`, `isPrototypeOf` or `propertyIsEnumerable`, with no rule for it. `merged[id]` then returns the inherited `Object.prototype` method. Because `typeof entry === 'function'`, it is called as a Condition, and `entry(ruleCtx)` returns `false`, so the chrome is hidden. An id with no rule should fall through to `always`. For `constructor`, `valueOf` and `toString` the result is an object or a string, not a boolean. The fix is to check `Object.hasOwn(merged, id)` before reading.
- evidence: read
- severity: low

## arrivalBounds applies its "px" cascade offset in world units
- where: packages/core/src/domains/ingestion/placement.ts:4,18 (arrivalBounds)
- scenario: `CASCADE_OFFSET_PX = 24` is added straight to world coordinates, while the sizes callers pass (imageHandler, svg unpackFiles, the ghost) are fractions of the viewport. At zoom 0.05, dropping 5 images fitted to the viewport steps each one about 1.2 screen px, so they look like a single image. At zoom 20 each step is 480 screen px and later items land off-screen. On a y-up (flipped) view, "down and right" goes up on screen. The offset should be divided by the view scale, for example derived from `viewportWorldRect` relative to the canvas size.
- evidence: read
- severity: low

## A throwing `step` leaves usePoseRun stuck as running forever
- where: packages/core/src/domains/poseRun/usePoseRun.ts:127-145 (tick), 170 (start)
- scenario: if `optsRef.current.step(...)` throws on some frame, `tick` exits before `halt` or `loop.request()`. `running.current` stays `true`, the previous frame's overrides stay published through the hold, and no frame is requested again. `isRunning()` then reports `true` indefinitely and `start()` does nothing ("idempotent while running"). Only an explicit `cancel()` or `stop()` recovers, and callers have no signal to call one. `tick` should halt and release (or cancel) when `step` throws.
- evidence: read
- severity: low

## enteredGroupScope only bumps its version while someone is subscribed
- where: packages/core/src/domains/selection/enteredGroupScope.ts:31-38 (subscribe / getVersion)
- scenario: the `NodeScope` contract (modes/scopingLayer.ts:26) says `getVersion` "bumps whenever the answers may have changed". This scope counts versions only from a listener on `entered`, which is attached on first subscribe and detached when the last listener leaves. If every subscriber unsubscribes (canvas hidden in an Activity, layers resubscribing) and the entered group changes in between, `alphaFor` and `isPointerInteractive` change but `getVersion()` doesn't. A reader that caches on the version keeps stale dimming and hit answers after resubscribing. `createScopingDim` avoids this by deriving its version from always-live state. The version should come from `entered` directly, or be bumped whenever `entered.get()` is seen to change.
- evidence: read
- severity: low

## createCanvasCamera.target() returns a stale heading during a glide it didn't start
- where: packages/core/src/domains/presentation/presentationStep.ts:110-121 (createCanvasCamera)
- scenario: a host steps to page 2 with an animated glide, so `heading` is page 2's view, and the glide finishes. Later something else calls `canvas.animateView` (a zoom-to-fit, the canvas's own `present.go`). While that animation runs, `isViewAnimating()` is true, so `target()` returns the old page-2 heading. A `stepPresentation(camera, pages, { by: 1 })` pressed then starts from page 2 and goes to page 3, not to the page after the one actually being glided to. `heading` is never cleared when its own glide ends.
- evidence: read
- severity: low

## `present.go { to: 'first' | 'last' }` can't reach a page with that id
- where: packages/core/src/domains/presentation/presentationStep.ts:45-49 (requestedPage); presentationContribution.ts:46-48 (requestOf)
- scenario: `PageRequest.to` is "its id, its index, or an end". The ends are checked first, so with `opts.pages` returning pages whose ids include `'first'` or `'last'`, or scene page nodes with such ids, `present.go { to: 'last' }` always shows the final page and never the page whose id is `'last'`. The two meanings share one string space with nothing to tell them apart.
- evidence: read
- severity: low

## Files read
packages/core/src/domains/chrome-caps/conditions.ts
packages/core/src/domains/chrome-caps/defaults.ts
packages/core/src/domains/chrome-caps/index.ts
packages/core/src/domains/chrome-caps/resolve.ts
packages/core/src/domains/chrome-caps/types.ts
packages/core/src/domains/chrome-caps/useChromeCaps.ts
packages/core/src/domains/chrome-caps/useHoverTracking.ts
packages/core/src/domains/ingestion/contentHandlers.ts
packages/core/src/domains/ingestion/index.ts
packages/core/src/domains/ingestion/openFilePicker.ts
packages/core/src/domains/ingestion/placement.ts
packages/core/src/domains/ingestion/useCanvasIngestion.ts
packages/core/src/domains/longPress/longPressFeedback.ts
packages/core/src/domains/modes/modeLayers.ts
packages/core/src/domains/modes/modeTriggers.ts
packages/core/src/domains/pathEffects/effectSources.ts
packages/core/src/domains/pathEffects/hiddenSources.ts
packages/core/src/domains/pathEffects/index.ts
packages/core/src/domains/pathEffects/readSource.ts
packages/core/src/domains/pathEffects/useEffectSourcesLayer.ts
packages/core/src/domains/poseRun/index.ts
packages/core/src/domains/poseRun/usePoseRun.ts
packages/core/src/domains/presentation/index.ts
packages/core/src/domains/presentation/presentationContribution.ts
packages/core/src/domains/presentation/presentationStep.ts
packages/core/src/domains/selection/enteredGroupFrame.ts
packages/core/src/domains/selection/enteredGroupScope.ts
packages/core/src/domains/selection/enteredOperands.ts
packages/core/src/domains/viewports/aim.ts
packages/core/src/domains/viewports/index.ts
packages/core/src/domains/viewports/viewMarker.ts
packages/core/src/domains/viewports/viewMarkerDrag.ts
packages/core/src/domains/viewports/viewResolver.ts
packages/core/src/domains/viewports/viewportLayer.ts

<!-- done: 6 findings, files read: 34 -->