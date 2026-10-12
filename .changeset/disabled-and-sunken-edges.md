---
'@weasel-js/theme': patch
'@weasel-js/ui': patch
---

Fixes: in light mode the 1px edge of a `PrefsForm` panel, a `PrefsPane` panel, and a `SelectionPanel` section or object panel was the same gray as the box's sunken fill, a contrast of 1.0. Those boxes, and a `PrefsForm` subpanel's rule, take their edge from a new token.

Adds a token: `--wzl-border-on-sunken`, the text color at 12% alpha, for the edge of a box filled with `--wzl-surface-sunken`.

Fixes: a disabled action button in a `Bar` dimmed to 0.4 where every other disabled cell dims to 0.5. A disabled text area in a `Bar` kept a full-strength button that opened onto the disabled text area; the button is disabled and dimmed with it. The pin on a disabled `PropertyRow`'s label still pinned and unpinned the row, which labkit's `ControlPanel` showed as a working "Pin" on a disabled row; it does nothing now, leaves the tab order, and reports `aria-disabled`.

Adds API: `BarPopover` takes `isDisabled`.
