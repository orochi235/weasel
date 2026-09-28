---
'@weasel-js/ui': patch
---

A `ToggleBar` in a crowded flex row no longer collapses its text segments to nothing. The bar and each segment are now never narrower than their labels, so a row takes width from its other children instead.
