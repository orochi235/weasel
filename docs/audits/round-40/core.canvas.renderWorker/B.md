# Audit round 40 — core.canvas.renderWorker

## A scene delta the worker fails to apply is still acked as drawn, so the page never resends it and the worker's copy stays half-applied
- where: packages/core/src/canvas/renderWorker/serveSceneRender.ts:209 (hostSceneRender's message listener), packages/core/src/canvas/renderWorker/sceneMirror.ts:50-71 (createSceneMirror.apply)
- scenario: The page adds or changes a node whose saved form names a registry key the worker module did not register (a node function registered on the page only), in the same delta that removes node R. `mirror.apply` deletes R from `nodes`/`specs`, then `specsFromSerialized` throws `SnapshotKeyError` before `order`, `specList` or `reconcileSpecs` run. The listener's catch posts `{ type: 'drawn', id }`, so the page's `frameAcks` settles `true`, `landed(true)` skips `frames.lost()`, and the page's `sceneDiff` believes the worker holds that delta. It never resends it: the changed nodes never reach the worker, R stays painted, and the next delta that carries `nodes` but no `order` builds `specList = order.map((id) => specs.get(id)!)` with `undefined` for R, so `reconcileSpecs` throws on every later frame, each again acked as drawn, until something forces a reset. The frame's `animations` ops are also dropped, since `animations.run` comes after `apply`. The non-fatal `error` message only warns on the page (`workerHealth.ts:103`); it does not call `lost`. Should: a frame that failed to apply answer so the page counts it lost (next frame a reset), or apply atomically.
- evidence: read
- severity: medium

## A detached-and-reattached canvas (Suspense re-suspend, Activity hidden) throws on remount: the client was disposed a task after release and the canvas cannot be transferred again
- where: packages/core/src/canvas/renderWorker/liveClients.ts:22-37 (holdRenderWorker); callers packages/core/src/canvas/renderWorker/WorkerSceneView.tsx:72-89 and useWorkerStack.ts:92-121
- scenario: A `<SceneViewCanvas worker>` (or `<SceneCanvas worker>`) inside a Suspense boundary that has already shown content suspends again. React keeps the DOM, hides it, and runs the layout-effect cleanups; `held.release()` schedules `LIVE.delete(canvas)` and `client.dispose()` one task later. When the data arrives (any time later) the layout effects run again on the same `<canvas>` element: `LIVE` has no entry, so `holdRenderWorker` calls `startSceneRenderWorker`, whose `canvas.transferControlToOffscreen()` throws `InvalidStateError` (control already transferred), and the throw escapes the layout effect to the nearest error boundary. The one-task grace only covers StrictMode's back-to-back cleanup and setup. Should: keep a disposed canvas recognizable and remount a fresh canvas (as `restart` does), or not throw from the effect.
- evidence: read
- severity: medium

## answerImage gives up waiting for a sharper raster on any image's ready event, not this source's
- where: packages/core/src/canvas/renderWorker/workerImages.ts:48-73 (answerImage)
- scenario: The worker asks for an SVG at 800×800; the page holds a 200×200 raster and has a re-raster pending. The first `attempt()` falls through and sets `tries = 1`. `subscribeImageReady` is the page's global image-ready emitter, with no source, so the next time any other image on the page lands, `attempt()` sees `tries > 0` and answers with the 200×200 raster before this source's re-raster lands. The comment says it "waits for one re-raster landing". On a page loading several images the worker paints the SVG blurry. Should: count only a landing that changed this source's raster (compare the bitmap, or wait while `imagePending(src)` holds).
- evidence: read
- severity: low

## hostSceneRender has no teardown and installs a realm-global image loader, so a second host in one worker steals the first one's image requests
- where: packages/core/src/canvas/renderWorker/serveSceneRender.ts:105-120 (hostSceneRender), packages/core/src/canvas/renderWorker/workerImages.ts:22 (loadFromPage → setImageLoader)
- scenario: `hostSceneRender` is public and takes a `RenderPort` so a worker can serve a `MessagePort`. A worker that serves two ports calls it twice: the second `loadFromPage` replaces the realm's image loader, so every SVG or `bitmapSrc` request from the first host's scene is asked of the second host's page, and a `bitmapSrc` name only the first page minted answers as an error. Each call also subscribes `subscribeImageReady`, `subscribeGlyphReady` and `subscribeNodeShapes` with nothing returned to unsubscribe, so a port that closes keeps its listeners (and its renderer and scene mirror) alive, posting `dirty` into a dead port for the life of the worker. Should: return a dispose, and route image requests per host.
- evidence: read
- severity: low

## snapshotStack never closes the ImageBitmaps the worker canvases answered with
- where: packages/core/src/canvas/renderWorker/workerStack.ts:136-148 (snapshotStack)
- scenario: Each `handle.snapshot()` on a `<SceneCanvas worker>` stack receives one transferred `ImageBitmap` per worker run, draws it onto the composed canvas, and drops it without `close()`; the early `return null` when `getContext('2d')` fails drops them too. A consumer that snapshots per frame (a thumbnail strip, a recorder) holds a full-canvas bitmap per worker run per call until GC gets to them. Should: `close()` each worker bitmap after drawing it, and on the early return.
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

<!-- done: 5 findings, files read: 21 -->
