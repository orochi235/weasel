---
'@weasel-js/ui': patch
---

`PrefsForm` and `PrefsDialog` take `foldable` in the rail layout: each top-level entry folds its nested entries away behind a fold mark, shut until its group is the one open. Click the mark, or press Right and Left on the entry, to unfold and fold it by hand. A filter unfolds everything, so every match shows.

`Disclosure` takes `tabIndex`, for a row whose own keys fold it.
