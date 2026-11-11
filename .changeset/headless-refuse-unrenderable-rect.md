---
"@weasel-js/headless": patch
---

A render request whose `sourceRect` has a width or height of zero or less, or whose `scale` has a zero axis, is refused in Node with an error naming the field, as the page's `renderSceneToPixels` refuses it, rather than starting Chromium only to fail there.
