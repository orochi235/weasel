---
'@weasel-js/path-tools': patch
---

With no path open and no tool to return to, `leavePathEdit` reports itself disabled, so Escape reaches the next binding, such as resetting the tool, on a canvas with no mode registry.

<!-- entry: fix -->
