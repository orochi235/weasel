---
'@weasel-js/core': patch
---

A derivation reading a dependency shown by a pose override's `path` now reads that path where it is painted. The override path is given in the painter's unturned box, and derivations were handed it as is: a path effect over a source whose override pose is turned read it unturned, and, under a composing strategy, the render and pick walks read a source inside a turned container where the container's local coordinates would put it.
