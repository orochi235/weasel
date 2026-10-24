---
'@weasel-js/core': patch
'@weasel-js/diagram': patch
---

A path effect whose source has an `'inherit'` fill or stroke paints that source in what it inherits from its containers, and follows a container's paint when it changes; it used to read as none. `DerivedDep` gains an optional `inherited`, which every dependency the scene builds carries, so any derivation can read the paint a dependency shows. `diagram:mark` resolves an `'inherit'` fill and stroke too.
