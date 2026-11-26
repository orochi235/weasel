---
'@weasel-js/routing': patch
---

An action fired by `trigger`, `begin`, `preview` or a menu row gets the deps its `requires` names, the same as when its key binding fires it.

An action without `requires` used to get selection, scene, history, view, activeTool and booleansAdapter on those paths alone. One that reads any of them now declares it: `requires: ['selection']`.

<!-- entry: fix behavior -->
