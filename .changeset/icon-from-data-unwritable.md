---
'@weasel-js/ui': patch
---

`resolveIcon` and `iconFromData` no longer throw in development on a BigInt or a cyclic object, such as a React element; they draw nothing.

<!-- entry: fix -->
