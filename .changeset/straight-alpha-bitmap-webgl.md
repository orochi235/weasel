---
'@weasel-js/renderer': patch
---

An `ImageBitmap` made with `premultiplyAlpha: 'none'` now draws right on WebGL, as an image command and as a `registerTexture` pattern, where it used to come out too bright wherever it was translucent. WebGL uploads a bitmap as it holds its pixels, and nothing reports which kind those are, so a bitmap bound for an image texture is drawn once into a scratch 2D canvas, which premultiplies a straight one and leaves a premultiplied one as it is, and the texture is uploaded from that. WebGPU already premultiplied both.
