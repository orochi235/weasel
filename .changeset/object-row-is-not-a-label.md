---
'@weasel-js/ui': patch
---

An object leaf's row in `PrefsForm` was a `<label>` around all of its fields, so a click on the object's name, or between its fields, toggled or focused the first field. The row is now a plain group, as a list, map, or union leaf's already was.
