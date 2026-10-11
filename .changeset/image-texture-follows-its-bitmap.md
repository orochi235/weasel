---
'@weasel-js/core': patch
---

Every `ImageBitmap` drawn through an image or sprites command left its GL texture allocated until the renderer was disposed, so drawing a fresh bitmap per frame (a video frame, a canvas snapshot, the pixel loupe) grew GPU memory without bound. The texture is now deleted on a later frame once its bitmap has been garbage collected.
