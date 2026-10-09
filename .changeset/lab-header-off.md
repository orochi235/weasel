---
"@weasel-js/labkit": patch
---

`<Lab header={false}>` renders no header bar: no title, add-trial or zoom controls, header contributions, or theme switcher, and none of the zoom controls' document-wide Mod+=, Mod+- and Mod+0. `<LabShell bar={false}>` is the same switch on the shell.

A trial's Mod+Z, Mod+Shift+Z and Mod+S now answer only while their buttons are offered, so suppressing `undo`, `redo` or `snapshot` leaves the chord to the browser.

The zoom controls, `scale` and `fps` are contributed only once a trial has a view, which an `initialView` sized to the viewport does not until the canvas is measured. They are now transient built-ins, so `suppress` no longer throws on them before then.
