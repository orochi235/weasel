---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
---

A field of an `object` pref marked `hidden` was drawn by `PrefsForm` whether or not `showHidden` was set. `visiblePrefSubtree` now drops an object leaf's hidden fields, and any section inside it that is left empty, the way it drops hidden leaves from a group; the object leaf itself stays, and a hidden field keeps its stored value when a shown one is edited.
