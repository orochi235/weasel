---
"@weasel-js/hud": patch
---

The hidden DOM a HUD mirrors a focused widget's accessibility tree into gives every node its own id. Ids were built by joining keys with `-`, so a node keyed `a-menu` and the child `menu` of a sibling keyed `a` shared one, and `aria-activedescendant` could name the wrong row. They are now built from each node's position.
