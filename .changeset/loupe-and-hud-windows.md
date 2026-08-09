---
"@weasel-js/hud": minor
"@weasel-js/core": minor
---

A loupe, and the window primitive it needed.

`hud.window()` is a draggable, resizable frame drawn in WebGL over the canvas —
titlebar, eight resize bands, close box. It paints no interior. Interiors come
from a new optional `content` painter on `Widget`, which `attachHud` draws
beneath every widget frame in the same layer, clipped to `contentRect`. That
painter receives `HudContentCtx`, carrying the scene data and view the hud layer
was already handed; `HudDrawCtx` stays data-free, so widgets remain renderable
headlessly. Painter commands are in absolute canvas coordinates — the group
carries a clip, not a transform.

`createLoupe()` is the first consumer: a window whose interior shows either the
scene re-rendered through a magnified inner view, or the actual framebuffer read
back and magnified 1:1. Both modes exist because neither answers both questions
honestly — a re-render is crisp at any magnification but its antialiased edge
colors are not the colors on screen, so the hex readout samples the framebuffer
in either mode. The frame stays parked and the pointer aims it; content freezes
while the pointer is over the window, which is what keeps the borders reachable.
Aiming uses its own `pointermove` listener rather than hud hover, because hud
hover comes from the layer's `onUncapturedMove` and stops during a captured drag
— exactly when a magnifier is most wanted.

Also fixed in the HUD: `hud.drag` pumped **world** coordinates into widgets
while `hud.press` sent screen coordinates, because the dispatcher builds
move/end contexts with an empty dep bag and the `view` lookup silently fell
through. Invisible at zoom 1, and a window that jumped and tracked backwards at
any other zoom. The drag action now captures its deps at gesture start.

`ImageDrawCommand` gains `sampling: 'linear' | 'nearest'`, applied per draw at
bind time rather than at upload, since `GLImageCache` keys textures by bitmap
identity. Without `nearest`, magnifying a framebuffer readback comes back
blurred, which defeats the readback.

**Behavior change in `@weasel-js/core`:** the select tool's area-select drag now
declines presses that a registered layer's hit-test claimed. It bound
`{ kind: 'drag', target: 'empty' }`, and the string form of `target` resolves
from the body only — chrome floating over empty canvas read as empty canvas, so
area-select swallowed drags on HUD widgets. The adjacent `clearSelection` click
binding already had the correct shape. Other tools that bind a bare
`{ kind: 'drag' }` still have this hole.
