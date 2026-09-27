---
"@weasel-js/core": patch
---

`fixedCornerOf(bounds, anchor)` is now exported from `@weasel-js/core`. It returns the corner a resize with that anchor leaves in place, the same one `resizeAction` pins, so code that reports or draws that corner no longer has to restate the rule.
