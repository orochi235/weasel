---
'@weasel-js/core': patch
---

`IconRegistryProvider` replaces its tables when `icons` changes. The tables it mounted with used to stay registered for its whole life, so a new `icons` value registered beside them rather than in their place. The first tables still register during the first render, so nothing draws without its glyph, and unmounting the provider releases whatever it holds.
