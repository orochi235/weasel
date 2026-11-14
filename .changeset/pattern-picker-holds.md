---
'@weasel-js/ui': minor
---

`PatternPicker` takes `disabled` and `readOnly`, and a `<Disabled>` or `<ReadOnly>` scope around it holds it.

A held picker commits no tile, image upload, size, or rotation. Held for a reason, or read-only, its swatches stay focusable and describe why; disabled with no reason anywhere, they leave the tab order.

<!-- entry: api new -->
