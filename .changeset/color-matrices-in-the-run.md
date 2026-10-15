---
'@weasel-js/renderer': patch
---

A gradient or an image under a group's color matrix shares a draw with what is around it. A run of batched draws now holds up to eight color matrices, each with its group alpha, and every vertex names its own, so a matrix that mixes channels, carries a bias, or scales past 1 no longer breaks the batch around the textured things inside it. A gradient under a matrix that only scales channels down is tinted on its vertices, as an image already was.

A solid or a glyph in a run that an image opened under a matrix is now mapped on the CPU like any other, where the shader used to map it; the pixels are the same.
