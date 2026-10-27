---
'@weasel-js/font': patch
'@weasel-js/renderer': patch
---

Drawing a glyph group allocates less each frame. `textureCacheKey` and `glyphFieldScale` keep their last answer, which is nearly always the next one asked for, rather than building a new string and pair per group, and the renderer stages a group's text color through one reused array where no color matrix maps it. Every frame of a static label pays these, as well as text that changes.
