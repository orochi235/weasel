---
'@weasel-js/gestures': patch
'@weasel-js/routing': patch
'@weasel-js/labkit': patch
---

A `hover` spec takes `held`: `'optional'` keeps it firing while a button is down, `true` fires it
only then, read the way `mods` reads a modifier. In a route it is `hover ?held` / `hover +held`.
The binding still claims nothing, so a drag keeps its moves; a hover's params gain `held`.
`useGestureDispatcher`'s `channels.hover` attaches hovers without the rest of the pointer channel,
so no press opens a gesture or captures the pointer.

The loupe now aims through the dispatcher (`loupe.aim`, `loupe.leave`) rather than listeners of its
own, and still follows the pointer through a drag. `useLoupe` alone no longer aims: mount
`<LoupeGestures>` with it, as `<TrialLoupe>` does.
