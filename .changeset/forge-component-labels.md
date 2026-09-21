---
'@weasel-js/forge': patch
---

The Components list no longer prefixes a component's name with part of its title (`weasel-ui/Sidebar`, `Primitives/StatusBar`) just because another library ships a component of the same name. The library tag already tells those apart; names are widened only where two components in the same library collide, such as the three `Gallery` stories.
