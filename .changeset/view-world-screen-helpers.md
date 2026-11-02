---
'@weasel-js/geom': patch
'@weasel-js/core': patch
'@weasel-js/labkit': patch
---

`@weasel-js/geom` exports `viewWorldToScreen(view, p)`, `viewScreenToWorld(view, p)` and
`viewRectToScreen(view, rect)`, which convert between world and screen through a `View` directly;
`@weasel-js/core` re-exports them. Core, guides, diagram, hud, labkit and path-tools now use them in
place of their own inline copies of the same arithmetic.

Under a flipped view (a negative `scale` axis), diagram overlays, labkit lens hit boxes and the
path-edit marquee now get a rect with a positive width and height. labkit's camera zoom keeps a
flipped axis flipped instead of turning it back to positive.
