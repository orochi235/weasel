---
'@weasel-js/editing': patch
---

Transforms that would rewrite a locked node inside a selected boolean group are disabled as locked, rather than throwing.

That covers Flip, Align, Distribute, Nudge, Swap (and a swap drop), and Transform Again; a rotate drag over such a group does not start.

<!-- entry: fix -->
