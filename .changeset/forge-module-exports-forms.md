---
'@weasel-js/forge': patch
---

forge follows a component or a `meta`/`story` wrapper exported as an `enum`, a destructured `const` off a namespace import, or an `export * as` re-export, rather than losing it.

<!-- entry: fix -->
