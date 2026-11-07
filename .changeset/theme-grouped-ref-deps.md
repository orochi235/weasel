---
'@weasel-js/theme': patch
---

A definition's reference written with its type group, such as `{color.surface}`, is now followed when baking, as `resolveTheme` already followed it. Before, the baker took it for a literal: the token was emitted once in `:root` instead of per mode, so in the stylesheet it kept the default mode's value everywhere, and a contrast rule could not see the color behind it.
