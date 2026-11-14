---
'@weasel-js/ui': minor
'@weasel-js/labkit': minor
---

New `<ReadOnly when reason>` keeps every kit value control inside it to its value; a container's `readOnly` does the same.

Text fields take native `readOnly`, so their text stays selectable and copyable. Checkboxes, switches, radio groups, toggle bars, selects, sliders, number boxes, color fields, and paint fields stay focusable, refuse changes, are marked `aria-readonly` where the role takes it, and say why in their tooltip and description when given `readOnlyReason`. Action buttons stay usable. Disabled beats read-only. `useReadOnly(own)` and `useControlAccess(own)` read the result for a control of your own.

<!-- entry: new api -->
