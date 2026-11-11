---
"@weasel-js/core": patch
"@weasel-js/headless": patch
---

core exports `checkPixelRenderRect(sourceRect, scale, prefix?)`, the check `renderSceneToPixels` makes of its rect and scale, from the root and from the React-free `@weasel-js/core/math`. headless's request reader now calls it rather than its own copy, so Node and the page refuse the same requests; headless's messages for those fields read as core's ("must be a positive finite number", "must be a nonzero finite number").
