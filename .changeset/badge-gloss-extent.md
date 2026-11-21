---
'@weasel-js/ui': patch
---

The `aqua` and `metal` Badge effects fade their gloss out at `glossExtent`, as documented. The gloss had faded out at `glossExtent² / 100` and stopped short of it: at the default 50, a quarter of the way down instead of halfway.

<!-- entry: fix visual -->
