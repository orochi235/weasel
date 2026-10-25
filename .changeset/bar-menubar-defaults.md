---
'@weasel-js/ui': patch
---

`Bar` and `MenuBar` now show a leaf whose path `values` lacks at its default, as `PrefsForm` and the other params surfaces do, and their `showIf`/`enableIf` conditions read that default too. Both used to treat the path as unset: a toggle defaulting on drew off, and a condition on it failed. This changes what an unset path looks like on these two components.
