---
'@weasel-js/gestures': patch
'@weasel-js/routing': patch
---

A `hover` binding can ask for the pointer leaving. `HoverSpec` takes `motion: 'leave'`, written `hover(leave)` in a route: the binding then runs when the pointer passes out of what it targets, onto something its `target` does not match or off the surface, in place of on each move. With no `target` it runs only when the pointer leaves the surface. Its params are those of the move that took the pointer out, or of the last move before it left the surface. Additive: `hover` gains a `motion` arg in the route grammar that defaults to `move`, `HoverEvent` gains `from` and `off`, and `HoverWhere` is exported. A binding for a move and one for a leave on the same target no longer read as a conflict.
