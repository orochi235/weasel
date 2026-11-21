---
'@weasel-js/ui': patch
---

A `ColorField` calls `onCancel` when a pick closes on the color it began from, so a preview opened from `onInput` ends.

The opacity slider then composes against `value` again, not the abandoned pick.

<!-- entry: fix behavior -->
