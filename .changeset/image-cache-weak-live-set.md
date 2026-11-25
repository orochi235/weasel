---
"@weasel-js/renderer": patch
---

A renderer dropped without `dispose()` no longer keeps its WebGL context and image textures alive, and stops limiting other renderers' image size.

<!-- entry: fix -->
