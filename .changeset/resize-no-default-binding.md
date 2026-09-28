---
"@weasel-js/core": patch
---

`resizeAction` no longer has a default binding. Its bare `{ kind: 'drag' }` claimed every drag at ambient scope and tied `areaSelect`'s, so a canvas with `pick` and `transform` warned `route conflict: [*] drag — declared by resize, areaSelect` on load. Resize handles still route to it through the `transform` preset. Code that registers `resizeAction` without that preset has to bind it to its handles itself, the way `selectionTransformBindings()` does.
