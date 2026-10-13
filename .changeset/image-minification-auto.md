---
'@weasel-js/renderer': patch
---

`WeaselRendererOptions.imageMinification` takes `'auto'`, a new value. The renderer uploads an image with linear filtering, as under `'linear'`, and builds its mipmaps the first time a frame draws it at two or more texels to the device pixel on either axis, counting the group transform, the display's pixel ratio, and a `source` rect. An image never drawn small is never mipmapped. `'linear'` stays the default and the screen canvas still uses it. In headless Chromium an image drawn at an eighth of its size reads the average of the texels under each pixel with `'auto'`, where `'linear'` reads one tap.
