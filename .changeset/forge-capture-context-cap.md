---
'@weasel-js/forge': patch
---

forge's capture browser keeps at most four device-pixel-ratio contexts open. It closes the least recently used, so a zoomed workshop in steady use no longer gathers one per ratio.

<!-- entry: fix -->
