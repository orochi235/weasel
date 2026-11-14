---
'@weasel-js/ui': minor
---

`Tree` takes `disabled` and `readOnly`, and a `<Disabled>` or `<ReadOnly>` scope around it holds it.

Disabled, nothing activates, folds, selects, or moves, by drag or by key; focus still moves between rows, and with no reason anywhere the tree leaves the tab order. Read-only, rows still fold, select, and activate, and nothing moves. Either way the controls in its rows are held with it, and a read-only treegrid is `aria-readonly`.

<!-- entry: api new -->
