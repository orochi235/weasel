---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A group's description now draws in every panel that renders one.

`<PropertyGroup description>` puts the text under the heading and above the
rows, through a new `<PropertyNote>` — a muted paragraph that spans both
columns, which is the group-level counterpart to `<PropertyRow description>`.
labkit's `ControlPanel` passes it, so a config group's `.describe()` reads the
same there as it already did in `PrefsForm`.
