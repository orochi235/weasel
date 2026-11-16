---
'@weasel-js/ui': patch
---

A sweep or Alt-drag reports each step through the latest `onChange`, against the value the consumer now holds.

This holds for `SegmentedBar`, `ToggleChips` and `CheckboxGroup`.

A handler that compares the reported list with its own `value` now writes exactly what each step moved, even when one move crosses several segments.

<!-- entry: fix -->
