---
'@weasel-js/hud': patch
---

A HUD window drawn before its canvas has a size keeps the place `setBounds` or a title drag gives it, not the top-left corner.

<!-- entry: fix -->
