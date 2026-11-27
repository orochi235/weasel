---
'@weasel-js/forge': patch
---

A project helper that re-exports forge's `meta` or `story` as a const, such as `export const defineMeta = meta`, is recognized as forge's own, so a story calling it gets its meta read.

<!-- entry: fix -->
