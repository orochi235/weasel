---
'@weasel-js/ui': patch
---

`FillStrokeSwatch` called `onChange` for a picked color only when the chip lost focus, so closing the picker left the edit as an uncommitted preview until the next click. It now commits when the picker closes, as `ColorField` does.
