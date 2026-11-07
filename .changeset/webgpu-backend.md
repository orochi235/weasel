---
'@weasel-js/renderer': patch
'@weasel-js/font': patch
'@weasel-js/core': patch
---

The renderer can draw with WebGPU. `new WeaselRenderer({ gpu: { device, canvas }, width, height, dpr })` builds one synchronously from a `GPUDevice` the caller holds, and `requestRendererDevice()` returns the page's one shared device, or `null` where WebGPU is unavailable. `gpu.antialias: false` draws the canvas single-sampled, as WebGL's `antialias` context attribute does; the default is 4× multisampled. A lost device is reported once and the renderer draws nothing after it.

`renderIdsAsync` reads ids back as a promise on either backend. `renderIds` stays synchronous on WebGL and throws on WebGPU, naming `renderIdsAsync`.

On WebGPU a program or effect draws from its WGSL. A custom program's WGSL supplies `fn fragment(in: Varyings) -> vec4f`, and optionally `fn vertex(v: KitVertex) -> Varyings`, inside the kit's prelude; its own uniforms are a struct at `@group(1) @binding(0)`, its textures group-1 variables each beside a `<name>_sampler`. An effect's WGSL supplies `fn effect(in: EffectVaryings) -> vec4f`. Coordinates are top-left: `kit.fragOrigin` is the drawing buffer's corner counted from the top. A program or effect without WGSL draws nothing on WebGPU and is reported once. The built-in blur and vignette carry WGSL.

A registered paint kind's WGSL supplies `fn fragment(in: PaintVaryings) -> vec4f`, and optionally `fn vertex(v: PaintVertex) -> PaintVaryings`, inside the kit's paint prelude, which reads the path vertex and declares `kit.proj`, `model`, `worldInv` and `origin`. `renderer.backend` says whether a renderer draws with `'webgl2'` or `'webgpu'`.

Core's canvases take `backend: 'webgl2' | 'webgpu' | 'auto'` (`<Canvas>`, `<SceneCanvas>`, `<DrawCanvas>`, `<SceneViewCanvas>`), default `'webgl2'`, and `CanvasBackendProvider` sets it for every canvas beneath it. `'auto'` takes WebGPU where a device is available and every program registered so far has WGSL. The choice is made at a canvas's first paint, which waits for the device; a tile of a shared canvas always paints with WebGL 2.

Breaking: `CanvasExtensionApi.pickAt` and `readIds` now return promises, so they read ids on WebGPU too. `readIdsSync` answers at once on WebGL and returns `null` on WebGPU; `geometry.picking: 'pixels'` reads it and walks the shapes where it is `null`.
