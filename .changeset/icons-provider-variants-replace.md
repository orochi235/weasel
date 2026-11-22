---
'@weasel-js/icons': minor
---

A new `variants` value on `IconRegistryProvider` drops every variant it no longer names, with the icons that variant loaded.

`provideVariants` takes `{ replace: true }` to do the same on a registry of your own; without it, it still only adds loaders.

<!-- entry: fix api -->
