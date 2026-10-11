---
'@weasel-js/core': patch
---

Under `?test=1`, `window.__weaselTest` kept answering for a canvas after it unmounted, so swapping one canvas for another without a page load left `getScene()` and `getActiveToolId()` reading the old one. The canvas that installed the hook now removes it when it unmounts, and the next canvas to mount installs its own.
