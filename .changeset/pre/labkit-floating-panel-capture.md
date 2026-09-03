---
"@weasel-js/labkit": patch
---

`FloatingPanel` no longer swallows a click on a control that is not a native
element.

It captured the pointer on pointerdown to drag itself. Capture retargets
mouseup, so the browser synthesizes no `click` on the child under the cursor —
and the guard exempting children was an element-name allowlist (`input`,
`button`, `a`, `select`, `textarea`, `[data-no-drag]`). Anything else in a panel
was therefore dead to a real mouse while a programmatic `.click()` still worked,
which is how it hid. A `role="button"` span, a component library's control that
renders a div, and a canvas were all affected.

The panel now arms on pointerdown and captures only once the pointer has moved
3px, so a press that does not move is never a drag. The allowlist stays, so
dragging _from_ a native control still does nothing.

Also documents the styling contract this came in alongside — see "Styling
labkit from your own stylesheet" in the recipes: classes are `lk-*`, tokens are
`--wzl-*`, and `var(--lk-…)` silently takes its fallback.
