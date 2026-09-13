---
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
---

**`MenuButton`** is a button that opens a list and acts on the row chosen,
holding no value of its own. It sizes to its label, not its widest row.

labkit's "Add trial…" (with more than one instrument) and "Load…" snapshot
controls are now `MenuButton`s rather than `Select`s held at no selection. A
screen reader announces them as menus, and the fixed 160px and 88px widths are
gone.
