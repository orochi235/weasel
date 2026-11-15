---
'@weasel-js/ui': minor
---

`ActionButton` takes native `<button>` attributes and handlers, forwards its `ref`, and runs a caller's handler before its own.

A caller's `onClick` runs before `onPress`, and its `onFocus`, `onBlur`, `onPointerEnter` and `onPointerLeave` before the preview's; one that calls `preventDefault()` skips the button's own. `onPointerDown` now runs beside a menu `popup`'s, first, instead of being replaced by it. `aria-label`, `aria-pressed`, `type`, and `disabled` stay the button's: `label`, `active`, and `disabled` set them, and `form` is still where it is drawn.

<!-- entry: api behavior -->
