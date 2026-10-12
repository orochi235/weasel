---
'@weasel-js/font': patch
'@weasel-js/core': patch
---

Fixes: a canvas font registered while its web font was still loading kept the fallback face's shapes and advances for the session. Measured in Chromium: a canvas draws a family it has not loaded in a fallback, and its `W` at 48px is more than a pixel off the real face's. The canvas tier now listens to `document.fonts` for `loadingdone` and measures the loaded families' faces again, in place, then signals `subscribeGlyphReady` so the text lays out again. The listener is added when the tier makes its first face.

Adds API: `refreshCanvasFont(family?)` does the same on request, for one family or for all of them. A `FontFace` loaded before it is added to `document.fonts` is never announced by the document, so that case needs the call.
