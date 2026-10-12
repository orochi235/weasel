---
'@weasel-js/hud': patch
---

Fixes: a pixel-mode loupe whose aim held still kept showing the old picture, and `loupe.color` the old color, after an undo or a nudge changed what was under it. The lens now reads the framebuffer and the color again on the frame that lands after the content version or the camera moves. Its own redraw moves neither, so the new picture does not ask for another.

Adds API: `createLoupe` takes `contentVersion`, the version of what the canvas paints; pass `CanvasExtensionApi.getPaintedVersion`. A lens given `views` reads it from there with no option. `LoupeHandle.refresh()` asks for a paint and re-reads on the frame that lands, for a change no version reports, such as a drag preview that has not committed. Without a version and without `refresh()`, an edit under a parked aim still shows only in vector mode.
