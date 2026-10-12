---
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

Adds API: range selection on the canvas. `useSelection({ mode: 'multi', range: 'shift', extend: 'meta' })` selects everything from the last pressed id through the one clicked, and `<SceneCanvas selectionOptions>` takes the same options. The hook now keeps an anchor: a plain or toggling click moves it, a range leaves it where it is, and a selection set by anything else ranges from its last id.

`order` names the sequence a range walks, for a host with one of its own, such as a layer panel's rows. Decided on an agent's judgment: with no `order`, a hook bound to a scene walks the order the scene paints in (`scene.renderOrder()`), and a hook with neither replaces on the range key. Nothing ranges unless `range` is set, so existing callers are unchanged.
