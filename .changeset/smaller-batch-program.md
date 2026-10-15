---
'@weasel-js/renderer': patch
---

A new renderer costs less to start drawing, which every one-shot `renderSceneToPixels` and every new canvas pays. In headless Chromium on SwiftShader, a one-shot render of one rect took 209 to 225 ms and now takes 129 to 139 ms, back where it was before runs held 15 textures and 8 color matrices; under ANGLE Metal with the shader cache warm, the first render went from 14 to 22 ms to 9.7 to 10.2 ms. Draws and pixels are unchanged.

The batch program samples the gradient ramp atlas from a fixed slot, and a run under one color matrix draws with a program that has no matrix array to index; a run under several builds the full program the first time one is drawn. The path, vertex-color, gradient and pattern programs are built on the first frame that uses them rather than with the renderer.
