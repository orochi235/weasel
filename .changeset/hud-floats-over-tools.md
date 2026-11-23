---
'@weasel-js/core': minor
'@weasel-js/routing': minor
'@weasel-js/hud': patch
---

The HUD, the loupe and its ring take their clicks and drags under any tool, the eyedropper and the hand included.

A layer hit can say it floats over the canvas with `LayerHit.floats` (carried to `AffordanceHit.floats`), and
`THROUGH_CHROME` no longer reaches through such a hit; the HUD's hits float.

<!-- entry: fix api -->
