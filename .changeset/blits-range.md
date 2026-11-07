---
'@weasel-js/core': patch
'@weasel-js/animator': patch
'@weasel-js/clock': patch
'@weasel-js/labkit': patch
---

Take `@msb235/blits` as `^1.0.0` instead of pinning `0.20.0` exactly, so an app on blits 1.x shares one copy with weasel rather than installing a second beside it. blits 1.0.0's one breaking change reserves the shader-patch name `lag`, which weasel does not use.
