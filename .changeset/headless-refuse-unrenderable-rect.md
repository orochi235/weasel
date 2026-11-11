---
"@weasel-js/headless": patch
---

headless refuses a render request with an empty `sourceRect` or a zero `scale` axis in Node, before Chromium starts.

The error names the field, as the page's `renderSceneToPixels` does.

<!-- entry: fix -->
