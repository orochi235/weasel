---
'@weasel-js/forge': patch
---

`mountWorkshop` uses the `changes` and `revision` passed to it rather than replacing them.

Edits emitted on those `changes` reload stories, and bumps of that `revision` invalidate captures alongside `revise()`.

<!-- entry: fix -->
