---
'@weasel-js/ui': patch
---

`PrefSchemaEditor`'s preview of a properties layout seeds its node with the default of each leaf a pointer shows in the layout's dialog, so a pointer's row draws that default where it drew unset. An edit to such a row stays in the preview and is not made a default, as in a toolbar's or a panel's preview.
