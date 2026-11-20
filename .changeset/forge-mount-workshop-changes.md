---
'@weasel-js/forge': patch
---

`mountWorkshop` uses the `changes` and `revision` passed to it: edits emitted on those `changes` reload stories, and bumps of that `revision` invalidate captures alongside `revise()`.

<!-- entry: fix -->
