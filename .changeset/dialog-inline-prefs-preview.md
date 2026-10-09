---
"@weasel-js/ui": patch
---

`Dialog` takes `inline`, which draws its box where it is rendered (no overlay, portal, focus trap, or scroll lock) for showing what a dialog looks like. `PrefsDialog` passes it through and, inline, lets the rail layout's box fit its container instead of holding a 760px minimum. `Dialog` now declares `aria-label` and puts it on the dialog element; before, it reached the overlay.

`PrefSchemaEditor`'s live preview is the whole preferences dialog, drawn inline with the rail layout's sections and subsections beside the settings, and its Literal and Changes sit side by side instead of in tabs.
