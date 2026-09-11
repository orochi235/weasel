---
'@weasel-js/labkit': patch
---

Two fixes to `<LabSwitcher>` found against a real consumer's header.

The menu takes the opaque `--wzl-surface` instead of `--wzl-surface-raised`,
which is translucent by design — it is for panels that blur what sits behind
them, and the menu sets no backdrop-filter. Over a lab's sidebar the controls
behind it read straight through.

The title no longer wraps. A consumer's header is usually a crowded flex row,
and the title is a click target now: left to wrap, `brick-icons corpus` breaks
after the hyphen and the control reads as three ragged lines with a caret
adrift from them.
