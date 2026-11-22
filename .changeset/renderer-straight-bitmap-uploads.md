---
'@weasel-js/renderer': patch
---

An image texture uploaded with `premultiply: false` holds straight texels on both WebGL and WebGPU, whatever kind of `ImageBitmap` it came from.

WebGL used to store a bitmap's texels as the bitmap held them, so a default (premultiplied) bitmap stayed premultiplied. WebGPU premultiplied every bitmap, so one made with `premultiplyAlpha: 'none'` came out premultiplied there only. `premultiply` now says what the texture holds on both backends. A bitmap that already holds premultiplied texels loses a little precision at low alpha when straightened, as it does in any browser.

<!-- entry: fix visual -->
