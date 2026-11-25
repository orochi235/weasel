---
"@weasel-js/renderer": patch
---

Changing a renderer's image minification, or restoring a lost context, no longer lets the image budget release bitmaps that are on screen before the next frame draws.

<!-- entry: fix -->
