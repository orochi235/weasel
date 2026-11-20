---
'@weasel-js/diagram': patch
---

A scene whose `diagram:theme` holds a theme that does not check draws in the fallback theme instead of crashing.

`diagramThemeFrom` checks a whole theme with `diagramThemeErrors` and warns once per value in development.

<!-- entry: fix -->
