---
'@weasel-js/ui': patch
---

A segment sweep canceled while the button is still held no longer lets the later release toggle the pressed segment.

This holds in `SegmentedBar`, `ToggleChips`, and `CheckboxGroup`.

<!-- entry: fix -->
