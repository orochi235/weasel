# renderWorker

`<SceneViewCanvas worker>` and `<SceneCanvas worker>`: a scene painted by a worker into a canvas
handed to it with `transferControlToOffscreen`. For whoever extends worker rendering or reviews what crosses
between the page and the worker. The decisions here date from 2026-11-06.

## API

```tsx
// render.worker.ts — the consumer's own worker module
import { serveSceneRender } from '@weasel-js/core/render-worker';
import './myShapes'; // registerNodeShape, registerFont, registerProgram({ glsl, wgsl }), …
serveSceneRender({
  scene: { registry },
  shaders: [myProgram],
  animations: { glow: ({ animator, params }) => tweenVertexColors(animator, { ...params, ms: 400 }) },
});

// the page
<SceneViewCanvas
  scene={scene}
  view={view}
  worker={() => new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module' })}
  workerRef={handle} // snapshot(), and animator.play('glow', { id, channel, from, to })
  clock={clockHandle} // optional: the worker's animator follows it
/>
```

`worker` replaces `drawOne`: the props are a union, and a worker view takes no `drawOne`,
`paintBounds` or `animator`, because each is a function the paint calls and a function cannot cross.
What paints a node is the worker module's to set up, as a page registers node shapes today.

An animation is code too, so it crosses the way a node function does: the worker module registers
each program under a key, and the page plays it by that key through `workerRef.current.animator`,
with `params` that cross as data. A program returns the handle of what it started, so the page can
cancel, pause or rescale it, and the animator's own `pauseKey`, `cancelAll` and the rest reach the
worker the same way. `animator` is not a prop of a worker view. Animations change paint: vertex
colors and stroke trims, through the animator's override registries. A program that writes to the
worker's copy of the scene is overwritten by the page's next change to it, since the page's scene
is the document.

`alphaFor` is the one function a worker view takes: the page calls it for every node each frame
and sends the alphas that changed.

A host that is not React calls `startSceneRenderWorker(worker, canvas, inputs)` and drives its
`sync()` from a frame loop of its own; `subscribe` says when a frame is due.

## The boundary

| Crosses page → worker | When |
|---|---|
| The `OffscreenCanvas`, transferred | once, at start |
| The scene's saved form (`scene.toJSON()`) | the first frame, and whenever the layer stack or document values change |
| Changed nodes, in that saved form; removed ids; the whole preorder when it moved | a frame after the scene's content version moved |
| Pose overrides, each override's `data` function already applied to the node's stored data | a frame after the overrides notified |
| Scroll offsets, all of them | a frame after any changed |
| Alphas from `alphaFor`, the changed ones | a frame where one changed |
| View, size and density, layer visibility and order, `cull` | a frame where one changed |
| `extraCommands` | a frame where the array changed |
| Animator calls (`play`, `cancel`, `pause`, `setTimeScale`, by id or by key) | the next frame, after its scene changes |
| The frame's time: the page's frame time, or the `clock`'s position and rate | every frame |
| That the page's frames are back after time nobody saw | the first frame after |
| A copy of an SVG raster, or of a `bitmapSrc` bitmap, the worker asked for, transferred | on request |

| Crosses worker → page | |
|---|---|
| `drawn` | after each frame; the page sends no frame while one is in flight |
| `dirty` | an image or glyph landed in the worker, its context came back, or its animator has something running |
| an image request | for an SVG source or a `bitmapSrc` name |
| a snapshot | on request |

**Scene changes, not draw commands.** Sending draw commands would keep the scene walk, every
painter, tessellation and text layout on the page, and offload only the GL calls — the cheap
part — while structured-cloning every frame's whole command tree. Sending changes moves the walk
and the painting to the worker, and a frame where one node moved sends that node.

**Saved form, so a function crosses as its key.** A node's `derivePath`, `layout` or
`clipFromPose` cannot be cloned, but `toJSON` already names each by its registry key, and the
worker's scene resolves the key against the same registry, given to `serveSceneRender`. A node
whose function has no key fails `toJSON` on the page, as it fails a save.

**The worker holds a real `Scene`.** It is built with `sceneFromJSON` and brought to each delta
with `reconcileSpecs`, so the worker walks it with `buildSceneViewCommands` exactly as
`<SceneViewCanvas>` does on the page: inherited paints, derived paths, container clips, layout.

**The page diffs.** It calls `toJSON()` once per frame where the content version moved and
compares each node's fields by reference against the last frame's: the scene replaces a pose or
data object when it changes one, so reference equality is the change test it already relies on.

## What stays on the page

Hit-testing, input, selection and overlays. The page still holds the scene, so geometric
hit-testing is unchanged; `<SceneViewCanvas>` is pointer-inert, and listeners attached through
`canvasRef` still fire on the transferred element.

## Frames and visibility

The worker runs no loop. The page's `useFrameLoop`, behind `useVisibleRaf`, calls `sync()`, which
posts one frame message, and the worker paints it as it arrives; a transferred canvas commits at
the end of that task. So the worker paints nothing while the canvas is off screen or the tab is
hidden, with no visibility signal of its own. One frame is in flight at a time: a `sync()` while
one is out marks a frame owed, and the worker's `drawn` asks for it.

The worker's animator (`hostAnimator` from `@weasel-js/animator`) moves only on these frames, at
the time each one carries, so it too stops while nothing can see the canvas. Without a `clock` it
runs on the page's frame times, and a frame loop that resumes says so, so the time it was hidden is
charged to no animation. With a `clock` it follows the clock's position as `useAnimator({ clock })`
does: the clock's pause holds it, its rate scales it, and a seek back plays the running animations
backward. The page asks for a frame whenever the clock moves or is sought; whoever owns the clock
syncs it, as on the page.

## Assets

**Images.** The worker's image cache decodes rasters itself, with `fetch` and
`createImageBitmap`. An SVG needs an `<img>` to rasterize from, so the worker's loader
(`setImageLoader`) asks the page, which answers from its own image cache with a clone of the
raster. An SVG raster is then held in both caches.

**Bitmaps the page made.** A `bitmapSrc` name carries a token of the realm that minted it, so the
page's names and the worker's never collide. A name the worker's cache does not hold and did not
mint goes to its loader, which asks the page; the page answers with a copy of its bitmap,
transferred, and the worker's cache holds it under the page's name as it would a load, dropping it
to fit its budget and asking again if it is drawn after. `adoptBitmapSrc(src, bitmap)` puts one
there directly.

**Fonts.** A canvas font has to be in the worker's own `self.fonts`; outline fonts load in the
worker from their URL. `watchFontLoads` listens to `self.fonts` where there is no document.

**Shaders.** A program registered in the worker module with `registerProgram({ glsl, wgsl })` and
handed to `serveSceneRender({ shaders })` is registered on the worker's renderer, as the `shaders`
prop does on the page.

## Resize, density, context loss, teardown

Size and density cross with the frame that changes them; the worker resizes its renderer, which
sizes the `OffscreenCanvas`. The element takes no `width`/`height` attributes
(`SurfaceCanvas buffer="worker"`): a transferred canvas cannot be resized from the page. The worker
sets `globalThis.devicePixelRatio` to the page's density, which `defaultDrawOne` reads.

A lost context skips frames; the renderer rebuilds itself on restore, and the worker sends `dirty`.

Unmount terminates the worker, and the context with it. A canvas can be transferred once, so a
StrictMode remount, which runs cleanup and setup back to back on one element, keeps the client:
cleanup releases it a task later and the setup in between takes it back.

## `<SceneCanvas worker>`

`<SceneCanvas worker={start}>` paints its scene layers from a render worker and everything else
on the page. Its layers, in draw order, are cut into runs by who paints them (`layerRuns`), and
each run is its own canvas in one stack, sized as a lone canvas would be:

| Run | Paints | Canvas |
|---|---|---|
| below the scene | background fill, grid, cell highlight, consumer layers before `scene` | the page's, its own renderer |
| the scene layers | `scene:<layerId>` (or `scene`) | the worker's, transferred |
| above the scene | ghosts of removed and in-flight nodes, selection and path-edit chrome, snap readout, consumer layers after `scene`, devtools overlays | the page's: the canvas that takes input, always on top |

A page layer between two scene layers (`after: 'scene:a'`) cuts the scene in two, and each part
gets a worker of its own, painting only its scene layers; `worker` is called once per part, and
the ref's animator plays an animation in every one. Hiding a layer does not cut a run, so the
stack holds still while visibility changes; a new cut restarts the workers.

The page still holds the scene, so geometric hit-testing, the gesture dispatcher, chrome and the
text editor are unchanged. A node an in-flight gesture is ghosting is sent to the worker at
alpha 0, the way the page leaves its committed paint out, and the page paints its ghost.

**Ids are a round trip away.** `readIdsAsync(rect)` and `pickAtAsync(x, y)` read every canvas of
the stack, the worker's last frame through `WeaselRenderer.renderIds` there, and give each pixel
the id of the highest canvas that painted one. `readIds` and `pickAt` throw in worker mode rather
than answer from part of the stack. Caching a whole id frame per frame would cost an id render
every frame to save a round trip a pick rarely needs, so the reads stay on demand. Both async
reads exist on every canvas and answer at once where the page paints it all.

**Every prop either works or is a type error.** The props are a union (`SceneCanvas/workerProps.ts`),
with `worker` required in its branch: ruled over an optional `worker` (2026-11-06), so `clock` without
`worker` stays a type error at the cost of wrappers distributing their `Omit` over the union:

| In worker mode | |
|---|---|
| `animator` | a type error: play animations through `ref.worker.animator`, with `clock` for a page clock |
| `paintInto`, `inputElement` | a type error: a transferred canvas cannot be a tile of a shared buffer |
| `geometry.picking: 'pixels'` | a type error: it reads ids synchronously; `'pose'` and `'shape'` work |
| `layers.scene` with `drawOne`, `toPose`, `objects`, `postProcess`, `paintBounds` and the other functions | a type error: the worker module's `drawOne` paints; `cull` and `ghostAlpha` cross |
| `layers.scene` as a pre-built layer, or `null` | works: the page paints it, and no worker starts |
| `alphaFor`, `layerVisibility`, `layerOrder` | work: alphas cross as they change, the run's layers as its `layerOrder` |
| `shaders`, `flattenTolerance`, `imageMinification`, `retain`, `debug` | apply to the page's canvases; the worker's renderer takes its own from `serveSceneRender` |
| `layerGroups` | apply to the page's runs; a group naming a worker-painted layer warns once, since its effects cannot reach the worker's canvas |

`ref.worker.snapshot()` composes the whole stack bottom first.
