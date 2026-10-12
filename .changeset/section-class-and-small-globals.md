---
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
---

labkit: `.section(label, { className })` puts a class on that section's frame in a `ControlPanel`, for a look one section alone takes.

forge: the Globals section of a trial's Settings draws its text at `--wzl-font-size-2xs`, the size of the CSS Vars rows, where it was `--wzl-font-size-sm`.
