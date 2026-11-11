---
"@weasel-js/menu": patch
---

`placeMenuUnder` keeps a menu opened on the `top` or `left` side of its button inside `bounds` when the button sits past the far edge. It placed the menu flush against the button, out of view.
