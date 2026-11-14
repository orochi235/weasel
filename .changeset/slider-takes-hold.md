---
'@weasel-js/ui': minor
---

`Slider` takes `disabled` and `readOnly`, and a `<Disabled>` or `<ReadOnly>` scope around it holds it.

A held slider refuses every drag, key step, track press, region drag, and right-click removal. Held for a reason, or read-only, its thumbs stay focusable and describe why; disabled with no reason anywhere, they leave the tab order. A slider driven by `useDetents` is held the same way.

<!-- entry: api new -->
