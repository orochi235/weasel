---
'@weasel-js/registry': patch
---

`ExtensionRegistry.register` throws a `TypeError` for an `undefined` value, which reads as no registration.

<!-- entry: fix behavior -->
