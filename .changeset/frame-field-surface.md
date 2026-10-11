---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A field inside a `PropertyGroup`, or any `MotifFrame` in the `rule`, `stereo`, or `tab` motif, is drawn on the plain surface. The frame's fill and a field's frame both defaulted to the sunken surface, so in light mode a text or number field in a group was the group's own color and could not be seen. That covers an `as: 'panel'` group, and a group with no `as`, in labkit's `ControlPanel`, which draws both as a `PropertyGroup`. The frame sets `--wzl-input-surface`, as a `PrefsForm` panel and a `SelectionPanel` section do.
