---
'@weasel-js/ui': patch
---

`@weasel-js/ui/components/Badge/bases`, `…/Badge/effects`, `…/Badge/shapes` and `…/MotifFrame/motifs` now load.

The `./components/*` wildcard reached them, and their declarations shipped, but no JavaScript was built for them, so an import typechecked and then failed at runtime. Each is now built like a component. Everything in them is also exported from `@weasel-js/ui/components/Badge` and `@weasel-js/ui/components/MotifFrame`.

<!-- entry: fix -->
