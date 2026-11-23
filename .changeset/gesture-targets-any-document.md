---
'@weasel-js/gestures': patch
---

`isEditableTarget`, `focusedControlOwnsKey`, and `isInControlWithin` recognize fields and controls in an iframe's document, so a page-level shortcut no longer takes a key typed into such a field and a host's press no longer swallows such a button's.

<!-- entry: fix -->
