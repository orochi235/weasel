---
'@weasel-js/ui': patch
---

`inferTokenType` reads a shadow whose `inset` comes last, such as `0 1px 2px red inset`, as a `shadow`, so `TokenPanel` files it under Depth.

<!-- entry: fix -->
