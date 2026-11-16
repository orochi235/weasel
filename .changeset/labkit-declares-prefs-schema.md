---
'@weasel-js/labkit': patch
---

labkit declares `@weasel-js/prefs-schema`, whose types its public API names

`PrefGroup` and `PrefNumber` in labkit's declarations now point at `@weasel-js/prefs-schema` rather than being copied into labkit's own types.

<!-- entry: fix -->
