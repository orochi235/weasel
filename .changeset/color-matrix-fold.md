---
'@weasel-js/renderer': patch
---

A group color matrix no longer breaks the batch for solid fills and atlas text. Their color is known before it reaches the GPU, so the renderer applies the matrix and the group's alpha to it on the CPU, with the shader's own clamp, and the shape stays in the run it would have ended. Images and gradients under a color matrix still draw under it as a uniform and still break the run. The picture does not change: in headless Chromium a solid mapped this way and an image of the same color mapped by the shader read back as the same pixel.
