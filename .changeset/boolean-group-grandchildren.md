---
'@weasel-js/core': patch
---

A group inside a boolean group is now one operand, the union of everything it shows, where before it counted for nothing. A derivation can read through a group to its contents: `DerivedDep.children` lists a dependency's children as dependencies, in the frame its own pose is in, and a memoized derivation that read them recomputes when one of them changes. This adds API.
