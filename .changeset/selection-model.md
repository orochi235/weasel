---
'@weasel-js/ui-logic': patch
'@weasel-js/ui': patch
---

Add `selection` and `selectionOfEach` to `@weasel-js/ui-logic`: which of a run of items are on, as one value, a list of them, or a boolean each item owns. The model gives each item's state (`on`, `off`, `mixed`), what a press does, and an `edit` that sets several in a row and can be reverted; `selectionKeys` says what the keyboard does with it, and `@weasel-js/ui`'s `selectionRoving` hands that to `useRovingTabIndex`. `ToggleBar` and `OptionsBar` run on it.

`ToggleBar`'s single mode takes `mixedValues` and `followsFocus`. With `followsFocus: false` its segments are toggle buttons whose arrows move focus without choosing, so a clearable enum's toggle in a property panel is a single-mode bar rather than a multiple-mode one held to one value.
