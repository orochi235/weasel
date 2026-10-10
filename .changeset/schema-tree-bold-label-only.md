---
'@weasel-js/ui': patch
---

`PrefSchemaEditor` marks a changed node by setting only its label bold in the structure tree. The mark used to sit on the whole tree item, so the row's count and kind badges went bold with it, and so did every row nested under a changed group.
