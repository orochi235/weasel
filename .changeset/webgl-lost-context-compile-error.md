---
'@weasel-js/renderer': patch
---

On WebGL, a program first used after the context is lost draws nothing instead of throwing a `ShaderCompileError` with an empty log.

<!-- entry: fix -->
