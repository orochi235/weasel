---
'@weasel-js/core': patch
---

`releaseImage(src)` drops an image's decoded bitmap and its GL textures from the kit's image cache, which otherwise keeps every `src` it has loaded for the life of the page; reading the `src` again reloads it. `retryImage(src)` reloads an image whose load failed, which used to stay failed until a page reload.
