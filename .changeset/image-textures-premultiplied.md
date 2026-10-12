---
'@weasel-js/renderer': patch
'@weasel-js/core': patch
---

Fixes: a translucent image was multiplied by its alpha twice. A half-transparent white bitmap on a cleared canvas read back as `(64, 64, 64, 128)` where `(128, 128, 128, 128)` is right, so every PNG with soft edges drew a dark fringe. A pattern tile registered from an `ImageBitmap`, which every built-in tile is, had the same fault, and one registered from an `<img>` painted differently from the same picture registered as an `ImageBitmap`.

Every image texture now holds premultiplied texels: an image command's bitmap, and a texture from `registerTexture`, whatever it was made from. The kit's shaders divide the alpha back out before a color matrix runs. Measured in headless Chromium by reading the framebuffer (`packages/renderer/src/imageAlpha.browser.test.ts`).

Breaking, in two places:

- A custom shader sampling a texture registered from an `HTMLImageElement` used to read straight texels and now reads premultiplied ones, as it always did for an `ImageBitmap`. Write `outColor = texture(u_image, uv)` where it had `vec4(c.rgb * c.a, c.a)`.
- An `ImageBitmap` handed to an image command or to `registerTexture` must hold premultiplied pixels, which is what `createImageBitmap` makes by default. One made with `premultiplyAlpha: 'none'` used to be the only kind that drew right and now draws too bright wherever it is translucent: the browser uploads a bitmap as it stands, and nothing reports which kind it is.

Opaque images are unchanged.
