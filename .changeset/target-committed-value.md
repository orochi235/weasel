---
'@weasel-js/core': patch
---

A `Target` answers its committed value with `committed()`, writes it with `commit(value)`, and carries its `axes`. Additive. Core's pose helpers, coast, and lifecycle wrapper read the committed pose through these, where they reached the animator's private state for it.
