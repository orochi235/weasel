---
'@weasel-js/ui': patch
---

A `PrefsForm` rail page draws its group's leaves and groups in schema order, as the columns and list layouts do. It used to draw every leaf first and the groups after, so `{ light: tab, note: leaf, dark: tab }` drew the row and then one `Light | Dark` strip. This changes what an existing rail form looks like wherever a leaf follows a group: the row now sits below that group, and two tabs with a row between them are two strips. Made on an agent's judgment; no one ruled on it.
