---
'@weasel-js/ui': patch
---

`useRovingTabIndex` passes over an item that is `hidden`, inert, or not drawn, so arrow keys and the tab stop land only on items a user can see.

<!-- entry: fix -->
