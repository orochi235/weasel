---
'@weasel-js/labkit': patch
---

`sectionTree` turns a section declared inside a group into a group of its own there, so `PrefsForm`'s rail layout draws it as a headed subsection of that group's page. It used to drop the heading and leave the rows loose. `pathAt` maps a path inside one back to its config path.

`.block()` on a field draws its control across the whole row with no label beside it, for an editor too wide for the control column.
