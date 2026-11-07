# Worker rendering: a scene view painted off the main thread

For whoever extends worker rendering in weasel, or reviews the boundary it draws. It says what
crosses between the page and the render worker, what stays on the page, and why.

**Built (2026-11-06):** `<SceneViewCanvas worker>`, the client under it (`startSceneRenderWorker`),
and the worker host (`serveSceneRender`, from `@weasel-js/core/render-worker`), pinned by
`packages/core/src/canvas/renderWorker/workerRender.browser.test.tsx`.
**Unbuilt:** `<SceneCanvas>` rendering in a worker; `alphaFor` and `animator` on a worker view;
scroll offsets; runtime bitmaps (`bitmapSrc`). Each is listed under "What is not built" with what
it needs.

## API

```tsx
// render.worker.ts — the consumer's own worker module
import { serveSceneRender } from '@weasel-js/core/render-worker';
import './myShapes'; // registerNodeShape, registerFont, registerProgram({ glsl, wgsl }), …
serveSceneRender({ scene: { registry }, shaders: [myProgram] });

// the page
<SceneViewCanvas
  scene={scene}
  view={view}
  worker={() => new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module' })}
  workerRef={handle} // handle.current.snapshot(): Promise<ImageBitmap | null>
/>
```

`worker` replaces `drawOne`: the props are a union, and a worker view takes no `drawOne`,
`alphaFor`, `paintBounds` or `animator`, because each is a function and a function cannot cross.
What paints a node is the worker module's to set up, as a page registers node shapes today.

A host that is not React calls `startSceneRenderWorker(worker, canvas, inputs)` and drives its
`sync()` from a frame loop of its own; `subscribe` says when a frame is due.

## The boundary

| Crosses page → worker | When |
|---|---|
| The `OffscreenCanvas`, transferred | once, at start |
| The scene's saved form (`scene.toJSON()`) | the first frame, and whenever the layer stack or document values change |
| Changed nodes, in that saved form; removed ids; the whole preorder when it moved | a frame after the scene's content version moved |
| Pose overrides, each override's `data` function already applied to the node's stored data | a frame after the overrides notified |
| View, size and density, layer visibility and order, `cull` | a frame where one changed |
| `extraCommands` | a frame where the array changed |
| SVG rasters the worker asked for | on request |

| Crosses worker → page | |
|---|---|
| `drawn` | after each frame; the page sends no frame while one is in flight |
| `dirty` | an image or glyph landed in the worker, or its context came back |
| an image request | for an SVG source |
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

## Assets

**Images.** The worker's image cache decodes rasters itself, with `fetch` and
`createImageBitmap`. An SVG needs an `<img>` to rasterize from, so the worker's loader
(`setImageLoader`) asks the page, which answers from its own image cache with a clone of the
raster. An SVG raster is then held in both caches.

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

## What is not built

- **`<SceneCanvas worker>`.** Its layer stack interleaves scene layers with layers whose painters
  are page functions (chrome, previews, consumer layers), so a worker scene needs the stack split
  into surfaces below and above the scene layers, each its own canvas. `readIds`, the GPU pick,
  needs a round trip to the worker's last frame.
- **`alphaFor` and `animator`.** Both are functions; they need their per-frame output (an alpha
  per id, an animator's color and trim overrides) carried as frame data, the way pose overrides
  are.
- **Scroll offsets** (`scene.scroll`) do not cross.
- **Runtime bitmaps** (`bitmapSrc`): a `weasel-bitmap:` name means nothing in the worker's cache,
  which has no way to adopt a bitmap under a name the page minted.
