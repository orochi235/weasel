---
'@weasel-js/ui': patch
---

A bar unmounted after a canceled sweep, with the pointer still down, no longer leaves listeners on `document`. This covers `SegmentedBar`, `ToggleChips`, and `CheckboxGroup`.

<!-- entry: fix -->
