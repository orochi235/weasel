---
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
---

`useRovingTabIndex` — the arrow-key focus behavior `ActionsBar`, `OptionsBar`,
and `ToggleBar` each implemented separately, now one hook they share (and one
`@weasel-js/ui` exports, re-exported through `@weasel-js/labkit/weasel-ui`).
It handles the tab stop, arrow/Home/End navigation with disabled items skipped
and wrap-around at both ends, and optional selection-follows-focus for
radiogroup-style bars. Its docs say when a bar should *not* use it: a
container of arbitrary compound controls has to leave the arrow keys to those
controls, which is why `ToolOptionsBar` still doesn't have one.

No keyboard behavior changed in any of the three bars.
