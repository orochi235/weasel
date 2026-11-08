---
'@weasel-js/paint': patch
'@weasel-js/loupe': patch
'@weasel-js/core': patch
'@weasel-js/hud': patch
'@weasel-js/labkit': patch
---

An eyedropper that samples exactly, as the loupe's complement.

`@weasel-js/loupe`: `createSampler` reads an ordered stack of pixel sources and composites translucent
layers source-over to the color a viewer sees, answering with a promise when a source does.
`createEyedropperModel` sits beside `createLoupeModel`: `hover`, `pick` and `color`, and given a loupe,
`hover` aims it. Breaking: `pixelHex` and `sourcePixel` are gone, folded into the sampler
(`canvasPixelSource`, and `rgbaHex` in `@weasel-js/paint`), and `CanvasSource.sample` is now `pixel`,
answering RGBA bytes rather than a hex.

`@weasel-js/core`: a `colorAt` dep (screen point to color), which `<SceneCanvas>` sources by redrawing
its document layers offscreen around the point — never the selection handles or other chrome over
them. `sampleLayers` names those layers. `useEyedropperTool` samples pixels through it when given no
`colorOf`, which is now optional. The canvas readback hud's loupe used (`createCanvasReader`,
`readGl`, `regionOnCanvas`, `regionAround`) moves to core, beside `createLayerSampler`,
`planLayerSample` and `RasterSession.renderCommands`.

`@weasel-js/hud`: `createLoupe` in vector mode with a `source` reports the color of those layers, not
the presented canvas.

`@weasel-js/labkit`: `sampleStack` is replaced by `stackSources` over the engine sampler, which reads
WebGL layers and composites translucent ones. A trial offers an Eyedropper toggle beside its loupe
toggle, and one readout of the color picked whose press copies it.
