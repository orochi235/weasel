---
'@weasel-js/forge': patch
---

`weaselforge build --out` follows the vite config's own `build.emptyOutDir`, and decides only where the config sets none. It still never empties the root or a directory holding it.

<!-- entry: fix -->
