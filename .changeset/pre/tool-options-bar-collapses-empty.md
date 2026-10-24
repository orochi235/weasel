---
'@weasel-js/ui': patch
---

`ToolOptionsBar` renders nothing when it has neither a `schema` nor children, where it used to draw an empty strip; a `label` alone no longer keeps it. So `CharacterOptions` outside a text edit renders nothing unless it has children. A host that relied on the row holding its height while empty, so the canvas below it does not move as an edit opens, now reserves that height itself, for example with a `min-height` of `var(--wzl-tb-height)` on a wrapper. This changes rendered output.
