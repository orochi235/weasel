---
'@weasel-js/core': minor
---

A canvas starts compiling its shaders as it first renders, before its element exists, so its first frame waits on them less.

`warmPrograms` is exported from `@weasel-js/core` too, to start them sooner still.

<!-- entry: perf api -->
