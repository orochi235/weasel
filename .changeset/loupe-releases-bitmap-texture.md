---
'@weasel-js/core': patch
'@weasel-js/hud': patch
---

`@weasel-js/core/renderer` exports `releaseImageSource(source)`, which frees the texture every live renderer holds for an image source at once. Call it when replacing a bitmap that will not be drawn again, such as a video frame or a canvas snapshot; drawing the source later uploads it again. The pixel loupe now calls it on each refresh and on dispose, where it used to leave each replaced bitmap's texture for the garbage collector.
