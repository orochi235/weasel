---
'@weasel-js/ui': patch
---

`inferTokenType` reads a shadow whose color nests a function as a `shadow`, so `TokenPanel` files it under Depth. For example, `0 2px 4px color-mix(in srgb, rgb(0 0 0) 20%, transparent)`.

<!-- entry: fix -->
