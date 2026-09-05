---
'@weasel-js/hud': patch
---

Read the loupe's magnified pixels on the frame that painted them.

Pixel mode called `gl.readPixels` straight off an aim change. Since the frame loop landed that is a moment with no paint behind it, so the lens showed the scene as it was one frame earlier — visible as a magnifier that lags whatever is being dragged under it.

The readback now happens from a frame subscription instead: an aim marks the lens dirty, and the next landed paint takes the sample. Coalescing is unchanged in effect — a refresh wanted while a bitmap is in flight survives until a frame finds it settled, so a fast drag still reads the aim it ends on.

Breaking for anyone building a `HudHost` by hand: it now requires `subscribeFrame(fn): () => void`, the same contract `CanvasExtensionApi` already exposes. `attachHud` passes the canvas's straight through, so consumers going through `useHud` / `attachHud` need no change. `Hud` gained a `subscribeFrame` of its own, which survives bind and unbind: a subscription taken before the HUD is bound starts firing when it is.
