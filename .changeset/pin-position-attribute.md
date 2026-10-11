---
'@weasel-js/core': patch
---

Every renderer program links `a_position` at location 0, so a registered paint kind whose vertex shader declares another attribute first still draws its mesh. A path drawn with per-vertex colors frees its color buffer with the draw and no longer leaves the attribute enabled on the mesh's vertex array.
