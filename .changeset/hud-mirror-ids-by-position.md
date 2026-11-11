---
"@weasel-js/hud": patch
---

A HUD's accessibility mirror gives every node a unique id, so `aria-activedescendant` no longer names the wrong row when keys contain `-`.

<!-- entry: fix -->
