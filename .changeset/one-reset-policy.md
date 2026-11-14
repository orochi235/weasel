---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A group's reset skips a leaf its `enableIf` disables, and a mixed leaf always offers a reset, in every params surface.

On every surface a reset compares a leaf's value as it is shown, an encoded one's read through its encoding, and leaves readouts alone. A `PrefsForm` given `onReset` now hears it once per leaf the reset changes, rather than once for the group. A labkit group's reset keeps a leaf that starts auto unpinned when it writes the group's value.

<!-- entry: fix behavior -->
