---
'@weasel-js/ui': minor
---

`SwatchGrid` takes `disabled` and `readOnly`, and a `<Disabled>` or `<ReadOnly>` scope around it holds it.

A held palette applies nothing on a click, a shift-click, a right-click, Enter, or Shift+Enter, on a straight grid and on rings alike, and records no recent color. Held for a reason, or read-only, its arrows still move among the swatches, which describe why; disabled with no reason anywhere, it leaves the tab order. `SwatchButton` takes `held` for the `aria-disabled`/`aria-readonly` and description a palette of its own passes each swatch.

<!-- entry: api new -->
