---
'@weasel-js/menu': patch
'@weasel-js/prefs': patch
'@weasel-js/routing': patch
'@weasel-js/hud': patch
---

Menus take access letters and links. `access` on `PrefBase`, `PrefGroup` and `PrefSection` names a menu item's letter; the resolver carries it, and an alias's own letter wins over its target's. `@weasel-js/menu` gains `accessMatch` (finds the item a typed letter selects), `withLinks` (runs a link row's `href` through a navigator the host passes), and `href` and `current` on items. `onEdge` is new on the menu controller, called when Left or Right is pressed at a boundary. Link rows now navigate in the WebGL host. `KeyEffect` gained an `edge` variant, and `keyStep` now returns it for Left and Right at a boundary, which breaks a consumer that switches exhaustively over the effect: add a case for it.
