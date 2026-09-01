---
'@weasel-js/core': patch
---

A stroked text node now gets hit reach from its stroke. `TEXT_PAINTER` declared
no `ink`, so picking fell back to a zero-outset default and a heavily outlined
glyph was unpickable across the width of its own outline.

`kit:derived` also now evaluates ahead of `kit:path` / `kit:shape` / `kit:image`.
A derived node whose `data` happens to carry a `path`, `shape` or `image` field
was silently painted by those painters instead of from its derived path.
