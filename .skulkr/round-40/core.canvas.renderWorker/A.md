# Audit round 40 — core.canvas.renderWorker

## A frame whose scene delta throws in the worker is acked as drawn, so the page never resends what it lost
- where: packages/core/src/canvas/renderWorker/serveSceneRender.ts:128-145 (hostSceneRender `frame`), :205-212 (message catch); page side packages/core/src/canvas/renderWorker/startSceneRenderWorker.ts:180, frameSync.ts:34-39
- scenario: a frame's `mirror.apply(msg.scene)` throws (a node whose function key the worker's registry lacks, a `specsFromSerialized` error, or `reconcileSpecs` failing part way). The catch posts `{ type: 'drawn', id }`, the page settles the ack as `true`, `landed(true)` skips `frames.lost()`, and the page's diff, `sent` cache and alpha map all believe the worker holds that frame. Everything after `mirror.apply` in the same message — overrides, scroll, alpha, view, layers, cull, extraCommands, size and the animator ops — was never applied, and none of it is sent again until it changes on the page: the worker paints a stale view/size, a half-reconciled scene that later deltas build on, and an animation `play` the page thinks is running never started. Should: a frame that failed before its inputs landed should answer so the page treats it as lost (resend everything), or the worker should apply the remaining inputs before rethrowing.
- evidence: read
- severity: medium

## A worker run decides layer visibility differently from the page: `scene` hidden whole, `defaultVisible` and `alwaysOn` are all lost
- where: packages/core/src/canvas/renderWorker/workerStack.ts:91-101 (paintWorkerRun); compare packages/core/src/core/layers/render.ts:264-271 (isLayerVisible) and packages/core/src/canvas/sceneLayerPaint.ts:67-79 (paintedSceneLayers)
- scenario: (1) a `<Canvas>` whose scene slot builds the single `scene` layer, painted by a worker, with `layerVisibility={{ scene: false }}`: `whole` is true, so the worker gets `layerVisibility: { scene: false }` and no `layerOrder`; `paintedSceneLayers` looks visibility up by `scene:<layerId>` only, finds nothing, and paints every scene layer — the page would have skipped the layer. (2) a worker-painted layer with `defaultVisible: false` and no explicit entry: only own entries of `frame.visibility` are copied, so the worker paints it while the page's `isLayerVisible` hides it. (3) an `alwaysOn` layer with an explicit `false` entry: the page shows it, the worker gets `false` and hides it. Should: resolve each run layer through `isLayerVisible` (and map the whole-`scene` case onto every scene layer, or skip the run) before handing the worker its `layerVisibility`.
- evidence: read
- severity: medium

## A worker canvas re-held more than a task after its release throws: the canvas was already transferred
- where: packages/core/src/canvas/renderWorker/liveClients.ts:22-37 (holdRenderWorker); callers packages/core/src/canvas/renderWorker/WorkerSceneView.tsx:72-89 (useSceneRenderWorker), packages/core/src/canvas/renderWorker/useWorkerStack.ts:92-121
- scenario: `<SceneViewCanvas worker>` (or a `<Canvas>` worker stack) inside React 19.2's `<Activity mode="hidden">`, or any parent that hides and later shows it without unmounting the DOM: hiding runs the layout effect's cleanup, `release()` disposes the client and deletes the `LIVE` entry one task later, and the canvas element survives. Showing re-runs the layout effect on that same element; `LIVE` has no entry, so `startSceneRenderWorker` calls `transferControlToOffscreen()` on a canvas already transferred, which throws `InvalidStateError` — it terminates the fresh worker and rethrows out of the layout effect, taking the tree to an error boundary instead of painting. The hold/release dance only covers cleanup and setup within one task (StrictMode). Should: a re-held canvas whose client is gone needs a new canvas element (as `restart` gives), or the client should be kept across a hide rather than disposed.
- evidence: read
- severity: medium

## A worker stack whose second worker fails to start leaks the first
- where: packages/core/src/canvas/renderWorker/useWorkerStack.ts:96-109 (useWorkerStack layout effect)
- scenario: a `<Canvas>` whose layers cut into two worker runs (a page layer between two scene layers), where `holdRenderWorker` throws for the second run (`start()` throws, e.g. a CSP or bad-URL `Worker` constructor error that only the second call hits, or the canvas transfer throws). The effect throws before returning its cleanup, so the first run's hold is never released: its worker is never terminated, its `subscribe(requestRedraw)` and `relay.follow` subscriptions stay, and `clients.current` keeps it. Should: release the holds already taken (and their subscriptions) before rethrowing.
- evidence: read
- severity: low

## `snapshotStack` never closes the worker bitmaps it composes
- where: packages/core/src/canvas/renderWorker/workerStack.ts:136-148 (snapshotStack)
- scenario: each `workerRef.snapshot()` on a `<Canvas>` worker stack receives one transferred `ImageBitmap` per worker run, draws them into the composite, and drops them without `close()`; their pixel memory (often GPU-backed, canvas-sized) is held until garbage collection, so repeated snapshots (a thumbnail strip, an export loop) pile up full-canvas bitmaps. Should: `close()` each worker bitmap after `drawImage`.
- evidence: read
- severity: low

## The page answers a worker's sharp-raster request with the small raster as soon as any unrelated image lands
- where: packages/core/src/canvas/renderWorker/workerImages.ts:48-73 (answerImage)
- scenario: the worker asks for an SVG `src` at a `size` larger than the raster the page's cache holds; `getImageBitmap(src, size)` starts a re-raster, `imagePending(src)` is true, so the first attempt waits and sets `tries = 1`. `subscribeImageReady` fires after *any* `src` resolves or errors, so the next image to land anywhere on the page — a different node's PNG, a failed load — re-runs `attempt`, which now sees `tries > 0` and replies with the too-small raster while this `src`'s own re-raster is still in flight. The worker paints a blurred SVG. The intent stated in the comment is to wait for this source's one re-raster landing. Should: count a try only when `src`'s own state changed (e.g. `imagePending(src)` went false, or the bitmap identity changed), not on every image-ready notice.
- evidence: read
- severity: low

## The client's warn-once set grows without bound on warnings whose detail varies
- where: packages/core/src/canvas/renderWorker/startSceneRenderWorker.ts:115-123 (onceEach), fed by workerHealth.ts:103,108 and frameSync.ts:49
- scenario: every worker `error` message (`report(e)` in the worker posts one per failed animator op and per thrown paint), every uncaught worker error and every unclonable frame adds `` `${what} ${String(detail)}` `` to `warned`, a `Set` that lives as long as the client and is never trimmed. A long-running `<SceneViewCanvas worker>` whose worker raises errors naming a node id, a frame time or a program key (e.g. `no animation registered as "<key>"` for page-chosen keys, a `drawOne` error naming the node) keeps one string per distinct message forever. Should: cap the set (or key it on `what` plus a bounded detail).
- evidence: read
- severity: low

## Files read
packages/core/src/canvas/renderWorker/WorkerCanvasStack.tsx
packages/core/src/canvas/renderWorker/WorkerSceneView.tsx
packages/core/src/canvas/renderWorker/frameSync.ts
packages/core/src/canvas/renderWorker/frameWriter.ts
packages/core/src/canvas/renderWorker/layerRuns.ts
packages/core/src/canvas/renderWorker/liveClients.ts
packages/core/src/canvas/renderWorker/protocol.ts
packages/core/src/canvas/renderWorker/requests.ts
packages/core/src/canvas/renderWorker/sceneDiff.ts
packages/core/src/canvas/renderWorker/sceneMirror.ts
packages/core/src/canvas/renderWorker/serveSceneRender.ts
packages/core/src/canvas/renderWorker/startSceneRenderWorker.ts
packages/core/src/canvas/renderWorker/statusRelay.ts
packages/core/src/canvas/renderWorker/testing/fakeWorker.ts
packages/core/src/canvas/renderWorker/testing/sceneRender.worker.ts
packages/core/src/canvas/renderWorker/useWorkerStack.ts
packages/core/src/canvas/renderWorker/workerAnimations.ts
packages/core/src/canvas/renderWorker/workerAnimator.ts
packages/core/src/canvas/renderWorker/workerHealth.ts
packages/core/src/canvas/renderWorker/workerImages.ts
packages/core/src/canvas/renderWorker/workerStack.ts

<!-- done: 7 findings, files read: 21 -->
