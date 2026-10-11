---
'@weasel-js/core': patch
---

`cloneAction` selects the copies it made, as `duplicateAction` does. After an Alt-drag the user holds the new nodes, so a second Alt-drag clones the copy rather than the originals again.
