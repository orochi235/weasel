---
'@weasel-js/ui': minor
---

`Timeline` takes `disabled` and `readOnly`, and a `<Disabled>` or `<ReadOnly>` scope around it holds it.

Held either way, no key is dragged, stepped, inserted, or deleted, the ruler does not scrub, and the key editor and easing picker change nothing. Read-only, keys and segments still select, rows fold, and the view zooms, pans, and switches to the graph; disabled, none of that responds, and with no reason anywhere the marks leave the tab order.

<!-- entry: api new -->
