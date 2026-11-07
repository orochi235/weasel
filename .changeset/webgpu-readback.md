---
'@weasel-js/renderer': patch
'@weasel-js/core': patch
'@weasel-js/hud': patch
---

`renderer.readPixels(rect)` reads back what the canvas's last frame left inside a rect of device pixels counted from its top-left, as premultiplied RGBA with rows top-down, on either backend. `readPixelsSync` answers at once on WebGL and throws on WebGPU. A WebGPU canvas keeps its last frame for this, as a WebGL canvas's preserved drawing buffer does. Core's `readCanvasPixels(canvas, rect)` reads a weasel canvas through whichever renderer paints it, and `canvasPaintsWith(canvas)` says which backend that is.

The loupe's pixel mode works on WebGPU canvases: it reads its region through `readCanvasPixels`, and answers the color under the aim from that region.

A WGSL program's uniform struct is laid out by WGSL's own rules, so where the browser has `uniform_buffer_standard_layout` an `array<vec2f, N>` or `array<f32, N>` member gets its real 8- or 4-byte stride rather than 16. Where it lacks the feature, a uniform struct that breaks the stricter uniform rules is refused when the program is built, naming the member, rather than drawing from misplaced values.
