---
'@weasel-js/ui': minor
---

`BandEditor` takes `disabled` and `readOnly`, and a `<Disabled>` or `<ReadOnly>` scope around it holds it.

A held editor moves no seam, band, or range end, and nothing splits, merges, or locks; read-only, a band can still be selected. Held for a reason, or read-only, its bands and ends stay focusable and describe why; disabled with no reason anywhere, they leave the tab order.

<!-- entry: api new -->
