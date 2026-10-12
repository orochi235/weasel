---
'@weasel-js/svg': patch
---

Fixes: `svgLeafFromKit` wrote a path leaf whose pose carries a `transform` as though it had none, so a skewed or stretched path exported unskewed. The whole frame, the rotation included, is now baked into the path's geometry and its gradient, and the node carries no `rotation`. Its stroke width takes the uniform part of the stretch, the way `parseSvg` reads a stroke under a skewed element.
