---
'@weasel-js/core': patch
---

`@weasel-js/core` re-exports the types of `@weasel-js/history` by name instead of with `export *`. The exported names are unchanged. A star re-export of another package emits no binding a consumer's bundler can enumerate, so a future runtime export of `@weasel-js/history` would have been missing from core's bundle with the typecheck green.
