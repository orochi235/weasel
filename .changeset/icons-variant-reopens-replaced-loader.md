---
'@weasel-js/icons': patch
---

A variant whose loader is replaced during a load that then fails goes back to `idle`, so a mounted `useIconVariant` loads the new one.

<!-- entry: fix -->
