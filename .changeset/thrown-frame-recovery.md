---
'@weasel-js/core': patch
---

After a frame that threw part-way (an unparseable color, clips nested past seven), `WeaselRenderer.render` drew that frame's leftovers into the next one: translucent shapes came out twice as opaque, and a throw inside a group with `effects` left the next frame painting into an offscreen buffer, with another buffer allocated on every throwing frame. Each frame now starts from an empty batch, the canvas's own framebuffer, and a full pool of effect buffers.
