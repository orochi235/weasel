---
'@weasel-js/renderer': patch
'@weasel-js/font': patch
---

The renderer can draw with WebGPU. `new WeaselRenderer({ gpu: { device, canvas }, width, height, dpr })` builds one synchronously from a `GPUDevice` the caller holds, and `requestRendererDevice()` returns the page's one shared device, or `null` where WebGPU is unavailable. `gpu.antialias: false` draws the canvas single-sampled, as WebGL's `antialias` context attribute does; the default is 4× multisampled. A lost device is reported once and the renderer draws nothing after it.

`renderIdsAsync` reads ids back as a promise on either backend. `renderIds` stays synchronous on WebGL and throws on WebGPU, naming `renderIdsAsync`.

On WebGPU a program or effect draws from its WGSL. A custom program's WGSL supplies `fn fragment(in: Varyings) -> vec4f`, and optionally `fn vertex(v: KitVertex) -> Varyings`, inside the kit's prelude; its own uniforms are a struct at `@group(1) @binding(0)`, its textures group-1 variables each beside a `<name>_sampler`. An effect's WGSL supplies `fn effect(in: EffectVaryings) -> vec4f`. Coordinates are top-left: `kit.fragOrigin` is the drawing buffer's corner counted from the top. A program or effect without WGSL draws nothing on WebGPU and is reported once. The built-in blur and vignette carry WGSL.
