---
'@weasel-js/routing': patch
---

The route-conflict check warns when a hotkey-tier action takes any press a lower tier's binding also matches, such as an untargeted `click` over a tool's `click` on `empty`, not only an exact match.

<!-- entry: fix -->
